"use client"

import { useState } from "react"
import { UserList } from "@/components/UserList"
import { ChatWindow } from "@/components/ChatWindow"
import { MessageCircle } from "lucide-react"

export default function Dashboard() {
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [selectedUsername, setSelectedUsername] = useState<string>("")

  const handleSelectUser = (userId: string, username: string) => {
    setSelectedUserId(userId)
    setSelectedUsername(username)
  }

  const handleBackToUsers = () => {
    setSelectedUserId("")
    setSelectedUsername("")
  }

  return (
    <div className="h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile header - always show Lumina on mobile */}
      <div className="md:hidden flex items-center p-4 border-b bg-card flex-shrink-0">
        <h1 className="text-xl font-bold gradient-primary bg-clip-text text-transparent">Lumina</h1>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* User List - Hidden on mobile when chat is selected */}
        <div
          className={`${selectedUserId ? "hidden md:block" : "block"} w-full md:w-80 lg:w-96 border-r flex-shrink-0`}
        >
          <UserList onSelectUser={handleSelectUser} selectedUserId={selectedUserId} />
        </div>

        {/* Chat Window - Full width on mobile when selected */}
        <div className={`${selectedUserId ? "block" : "hidden md:block"} flex-1 min-h-0`}>
          {selectedUserId ? (
            <ChatWindow
              selectedUserId={selectedUserId}
              selectedUsername={selectedUsername}
              onBackToUsers={handleBackToUsers}
            />
          ) : (
            <div className="hidden md:flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">Welcome to Lumina</h3>
                <p>Select a user to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
