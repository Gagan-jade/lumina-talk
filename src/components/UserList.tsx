import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessageCircle, LogOut, Search } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  is_online: boolean;
  last_seen: string;
}

interface UserListProps {
  onSelectUser: (userId: string, username: string) => void;
  selectedUserId?: string;
}

export function UserList({ onSelectUser, selectedUserId }: UserListProps) {
  const { user, signOut } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    fetchProfiles();
    fetchCurrentUserProfile();

    // Subscribe to real-time profile updates
    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchProfiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchProfiles = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('user_id', user.id)
      .order('is_online', { ascending: false })
      .order('username');

    if (data) {
      setProfiles(data);
    }
  };

  const fetchCurrentUserProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setCurrentUserProfile(data);
    }
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chatify
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        
        {currentUserProfile && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <Avatar>
              <AvatarFallback className="gradient-primary text-primary-foreground">
                {getInitials(currentUserProfile.username)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-medium">{currentUserProfile.username}</div>
              <div className="flex items-center gap-2">
                <div className="online-dot"></div>
                <span className="text-sm text-muted-foreground">Online</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 pb-4">
        <ScrollArea className="h-[calc(100vh-350px)]">
          <div className="space-y-1 px-4">
            {profiles
              .filter(profile => 
                profile.username.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((profile) => (
              <Button
                key={profile.user_id}
                variant={selectedUserId === profile.user_id ? "secondary" : "ghost"}
                className="w-full justify-start h-auto p-3 transition-smooth"
                onClick={() => onSelectUser(profile.user_id, profile.username)}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="relative">
                    <Avatar>
                      <AvatarFallback>
                        {getInitials(profile.username)}
                      </AvatarFallback>
                    </Avatar>
                    {profile.is_online && (
                      <div className="absolute -bottom-1 -right-1 online-dot"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="font-medium">{profile.username}</div>
                    <div className="flex items-center gap-2">
                      {profile.is_online ? (
                        <Badge variant="secondary" className="text-xs">
                          Online
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {formatLastSeen(profile.last_seen)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
            
            {profiles.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No other users found</p>
                <p className="text-sm">Invite friends to start chatting!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}