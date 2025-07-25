import { useState } from 'react';
import { UserList } from '@/components/UserList';
import { ChatWindow } from '@/components/ChatWindow';

export default function Dashboard() {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUsername, setSelectedUsername] = useState<string>('');

  const handleSelectUser = (userId: string, username: string) => {
    setSelectedUserId(userId);
    setSelectedUsername(username);
  };

  return (
    <div className="h-screen flex bg-background">
      <div className="w-1/3 border-r">
        <UserList 
          onSelectUser={handleSelectUser}
          selectedUserId={selectedUserId}
        />
      </div>
      
      <div className="flex-1">
        {selectedUserId ? (
          <ChatWindow 
            selectedUserId={selectedUserId}
            selectedUsername={selectedUsername}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Select a user to start chatting</h3>
              <p>Choose someone from the user list to begin a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}