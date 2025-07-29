"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send } from "lucide-react"
import { io, type Socket } from "socket.io-client"

interface Message {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  created_at: string
}

interface ChatWindowProps {
  selectedUserId: string
  selectedUsername: string
  onBackToUsers?: () => void
}

export function ChatWindow({ selectedUserId, selectedUsername, onBackToUsers }: ChatWindowProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  // Function to scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (!user || !selectedUserId) return

    // Initialize socket connection
    socketRef.current = io("http://localhost:8080")

    initializeConversation()
    fetchSelectedUserProfile()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [user, selectedUserId])

  useEffect(() => {
    if (!conversationId) return

    fetchMessages()

    // Subscribe to real-time message updates
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Scroll to bottom when conversation changes
  useEffect(() => {
    if (conversationId) {
      // Small delay to ensure messages are rendered
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }, [conversationId])

  const initializeConversation = async () => {
    if (!user) return

    // Try to find existing conversation
    let { data: existingConversation } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(participant_one.eq.${user.id},participant_two.eq.${selectedUserId}),and(participant_one.eq.${selectedUserId},participant_two.eq.${user.id})`,
      )
      .single()

    if (!existingConversation) {
      // Create new conversation
      const { data: newConversation } = await supabase
        .from("conversations")
        .insert({
          participant_one: user.id,
          participant_two: selectedUserId,
        })
        .select("id")
        .single()

      existingConversation = newConversation
    }

    if (existingConversation) {
      setConversationId(existingConversation.id)
    }
  }

  const fetchMessages = async () => {
    if (!conversationId) return

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (data) {
      setMessages(data)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !conversationId) return

    const message = {
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: selectedUserId,
      content: newMessage.trim(),
    }

    // Send via socket for real-time
    if (socketRef.current) {
      socketRef.current.emit("chat-message", message)
    }

    // Save to database
    await supabase.from("messages").insert(message)
    setNewMessage("")
  }

  const fetchSelectedUserProfile = async () => {
    if (!selectedUserId) return

    const { data } = await supabase.from("profiles").select("*").eq("user_id", selectedUserId).single()

    if (data) {
      setSelectedUserProfile(data)
    }
  }

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase()
  }

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "Active just now"
    if (diffInMinutes < 60) return `Active ${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `Active ${Math.floor(diffInMinutes / 60)}h ago`
    return `Active ${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const getActiveStatus = () => {
    if (!selectedUserProfile) return "Active now"
    if (selectedUserProfile.is_online) {
      return "Active now"
    } else if (selectedUserProfile.last_seen) {
      return formatLastSeen(selectedUserProfile.last_seen)
    }
    return "Last seen unknown"
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex items-center gap-3 p-3 md:p-4 border-b bg-card flex-shrink-0">
        <Avatar className="h-8 w-8 md:h-10 md:w-10">
          <AvatarFallback className="text-xs md:text-sm">{getInitials(selectedUsername)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm md:text-base truncate">{selectedUsername}</h3>
          <p className="text-xs md:text-sm text-muted-foreground">{getActiveStatus()}</p>
        </div>
        <div className="md:hidden">
          <Button variant="ghost" size="sm" onClick={onBackToUsers} className="text-muted-foreground">
            Back to Users
          </Button>
        </div>
      </div>

      {/* Messages Area - Scrollable */}
      <div className="flex-1 overflow-hidden min-h-0">
        <ScrollArea className="h-full px-3 md:px-4" ref={scrollAreaRef}>
          <div className="space-y-2 md:space-y-4 py-2 md:py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_id === user?.id ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[80%] p-2 md:p-3 rounded-lg text-sm md:text-base ${
                    message.sender_id === user?.id ? "chat-bubble-sent" : "chat-bubble-received"
                  }`}
                >
                  <p className="break-words">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="p-3 md:p-4 border-t bg-background flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="flex-1 text-sm md:text-base resize-none"
          />
          <Button onClick={sendMessage} disabled={!newMessage.trim()} size="sm" className="px-3 md:px-4 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
