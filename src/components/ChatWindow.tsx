import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
}

interface ChatWindowProps {
  selectedUserId: string;
  selectedUsername: string;
}

export function ChatWindow({ selectedUserId, selectedUsername }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user || !selectedUserId) return;

    // Initialize socket connection
    socketRef.current = io('http://localhost:8080');
    
    initializeConversation();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, selectedUserId]);

  useEffect(() => {
    if (!conversationId) return;

    fetchMessages();

    // Subscribe to real-time message updates
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const initializeConversation = async () => {
    if (!user) return;

    // Try to find existing conversation
    let { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_one.eq.${user.id},participant_two.eq.${selectedUserId}),and(participant_one.eq.${selectedUserId},participant_two.eq.${user.id})`)
      .single();

    if (!existingConversation) {
      // Create new conversation
      const { data: newConversation } = await supabase
        .from('conversations')
        .insert({
          participant_one: user.id,
          participant_two: selectedUserId
        })
        .select('id')
        .single();

      existingConversation = newConversation;
    }

    if (existingConversation) {
      setConversationId(existingConversation.id);
    }
  };

  const fetchMessages = async () => {
    if (!conversationId) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !conversationId) return;

    const message = {
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: selectedUserId,
      content: newMessage.trim()
    };

    // Send via socket for real-time
    if (socketRef.current) {
      socketRef.current.emit('chat-message', message);
    }

    // Save to database
    await supabase.from('messages').insert(message);

    setNewMessage('');
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>
              {getInitials(selectedUsername)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">{selectedUsername}</div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.sender_id === user?.id
                      ? 'chat-bubble-sent'
                      : 'chat-bubble-received'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}