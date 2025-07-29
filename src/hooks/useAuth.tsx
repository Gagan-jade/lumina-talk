import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Update online status when user signs in/out
        if (session?.user) {
          setTimeout(() => {
            updateOnlineStatus(true);
          }, 0);
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateOnlineStatus = async (isOnline: boolean) => {
    if (!user) return;
    
    await supabase
      .from('profiles')
      .update({ 
        is_online: isOnline,
        last_seen: new Date().toISOString()
      })
      .eq('user_id', user.id);
  };

  const signUp = async (email: string, password: string, username: string) => {
    // Check if username already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();
    
    if (existingProfile) {
      const error = { message: "Username already exists" };
      toast({
        title: "Sign up failed",
        description: "Username already exists",
        variant: "destructive"
      });
      return { error };
    }

    // Check if email already exists by attempting sign up without confirmation
    // We'll use a dry-run approach to check email existence
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: 'temp-password-for-check',
      options: {
        data: { username },
        emailRedirectTo: 'about:blank' // Prevent any actual email sending
      }
    });

    // If no error, the email is available, but we need to sign out this temp user
    if (!authError && authData.user && !authData.user.email_confirmed_at) {
      // Clean up the temp signup
      await supabase.auth.signOut();
    }

    // If email already exists, Supabase will return a specific error
    if (authError) {
      if (authError.message.includes('already registered') || 
          authError.message.includes('already been registered') ||
          authError.message.includes('User already registered')) {
        const error = { message: "Email already exists" };
        toast({
          title: "Sign up failed",
          description: "Email already exists, please login",
          variant: "destructive"
        });
        return { error };
      }
    }

    // If we reach here, both username and email are unique, proceed with actual signup
    const redirectUrl = window.location.hostname === 'localhost' 
      ? `http://localhost:${window.location.port || '5173'}/auth?verified=true`
      : `${window.location.origin}/auth?verified=true`;
    
    const { error: finalError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username
        }
      }
    });
    
    if (finalError) {
      toast({
        title: "Sign up failed",
        description: finalError.message,
        variant: "destructive"
      });
      return { error: finalError };
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link"
      });
      return { error: null, success: true };
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    
    if (error) {
      toast({
        title: "Google sign-in failed",
        description: error.message,
        variant: "destructive"
      });
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      let errorMessage = error.message;
      
      // Handle email not verified case
      if (error.message.includes('Email not confirmed') || 
          error.message.includes('email not verified') ||
          error.message.includes('not confirmed')) {
        errorMessage = "Email not verified yet. Please check your email and click the verification link.";
      }
      
      toast({
        title: "Sign in failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
    
    return { error };
  };

  const signOut = async () => {
    if (user) {
      await updateOnlineStatus(false);
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}