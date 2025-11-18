import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "../services/api";
import { useSocket } from "./SocketContext";

interface Chat {
  id: number;
  name?: string; 
  isGroup: boolean;
  participants?: any[]; 
  lastMessage?: string;
  updatedAt?: string;
}

interface Message {
  id: number;
  chatId: number;
  senderId: number;
  content: string;
  createdAt: string;
  sender?: {
    id: number;
    username: string;
    avatarUrl?: string;
  };
}

interface ChatContextType {
  chats: Chat[];
  currentChat: Chat | null;
  messages: Message[];
  loading: boolean;
  unreadChats: Set<number>; 
  fetchChats: () => void;
  enterChat: (chatId: number) => void;
  sendMessage: (content: string) => void;
  createGroupChat: (name: string, participantIds: number[]) => void;
  markChatAsRead: (chatId: number) => void; 
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};

export const ChatProvider = ({ children, currentUser }: { children: ReactNode; currentUser: any }) => {
  const { socket } = useSocket();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [unreadChats, setUnreadChats] = useState<Set<number>>(new Set());

  const fetchChats = async () => {
    if (!currentUser) return;
    try {
      const res = await api.get("/chats");
      setChats(res.data);
    } catch (error) {
      console.error("Error fetching chats", error);
    }
  };

  const enterChat = async (chatId: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/chats/${chatId}/messages`);
      setMessages(res.data);

      const found = chats.find((c) => c.id === chatId);
      setCurrentChat(found || null);

      markChatAsRead(chatId);

      socket?.emit("join_chat", chatId);
    } catch (error) {
      console.error("Error entering chat", error);
    } finally {
      setLoading(false);
    }
  };

  const markChatAsRead = (chatId: number) => {
    setUnreadChats((prev) => {
        const newSet = new Set(prev);
        newSet.delete(chatId);
        return newSet;
    });
  };

  const sendMessage = async (content: string) => {
    if (!currentChat || !socket) return;
    try {
      const messageData = {
        chatId: currentChat.id,
        senderId: currentUser.id,
        content,
      };
      socket.emit("send_message", messageData);

    } catch (error) {
      console.error("Error sending message", error);
    }
  };

  const createGroupChat = async (name: string, participantIds: number[]) => {
    try {
      await api.post("/chats/group", { name, participantIds });
      fetchChats();
    } catch (error) {
      console.error("Error creating group", error);
    }
  };

  useEffect(() => {
    fetchChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (msg: Message) => {
      console.log("📩 New message received:", msg);

      if (currentChat && currentChat.id === msg.chatId) {
        setMessages((prev) => [...prev, msg]);
      } else {
        setUnreadChats((prev) => new Set(prev).add(msg.chatId));
        
        // звук уведомления
        // const audio = new Audio('/message_sound.mp3');
        // audio.play().catch(()=>{});
      }

      setChats((prevChats) => 
        prevChats.map(chat => 
            chat.id === msg.chatId 
            ? { ...chat, lastMessage: msg.content } 
            : chat
        )
      );
    };

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [socket, currentChat]);

  return (
    <ChatContext.Provider
      value={{
        chats,
        currentChat,
        messages,
        loading,
        unreadChats,
        fetchChats,
        enterChat,
        sendMessage,
        createGroupChat,
        markChatAsRead
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};