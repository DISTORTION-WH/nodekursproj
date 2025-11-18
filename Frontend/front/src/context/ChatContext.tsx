import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "../services/api";
import { useSocket } from "./SocketContext";

interface Chat {
  id: number;
  name?: string; 
  isGroup: boolean;
  participants?: any[]; 
  avatarUrl?: string;
  username?: string; 
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
  currentUser: any; 
  fetchChats: () => void;
  enterChat: (chatId: number) => void;
  sendMessage: (content: string) => void;
  createGroupChat: (name: string, participantIds: number[]) => void;
  markChatAsRead: (chatId: number) => void;
  deleteMessages: (allForEveryone: boolean) => void;
  // Модальные окна
  modalView: "invite" | "members" | null;
  friendsForInvite: any[];
  chatMembers: any[];
  openInviteModal: () => void;
  openMembersModal: () => void;
  closeModal: () => void;
  handleInvite: (friendId: number) => void;
  handleKick: (userId: number) => void;
  handleGetInviteCode: () => void;
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
  
  // Уведомления о непрочитанных
  const [unreadChats, setUnreadChats] = useState<Set<number>>(new Set());

  // Модальные окна
  const [modalView, setModalView] = useState<"invite" | "members" | null>(null);
  const [friendsForInvite, setFriendsForInvite] = useState<any[]>([]);
  const [chatMembers, setChatMembers] = useState<any[]>([]);

  // Получение списка чатов и подписка на сокеты
  const fetchChats = async () => {
    if (!currentUser) return;
    try {
      const res = await api.get("/chats");
      setChats(res.data);

      // ВАЖНО: Подписываемся на события всех чатов
      if (socket) {
        res.data.forEach((c: Chat) => {
          socket.emit("join_chat", c.id);
        });
      }
    } catch (error) {
      console.error("Error fetching chats", error);
    }
  };

  // Вход в конкретный чат
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
      await api.post(`/chats/${currentChat.id}/messages`, { text: content });
    } catch (error) {
      console.error("Error sending message", error);
    }
  };

  const deleteMessages = async (allForEveryone: boolean) => {
    if (!currentChat) return;
    try {
      await api.post(`/chats/${currentChat.id}/messages/delete`, { allForEveryone });
      if (!allForEveryone) {
         setMessages([]);
      }
    } catch (error) {
      console.error("Error deleting messages", error);
    }
  };

  const createGroupChat = async (name: string, participantIds: number[]) => {
    try {
      const res = await api.post("/chats/group", { name });
      fetchChats();
      enterChat(res.data.id);
    } catch (error) {
      console.error("Error creating group", error);
    }
  };

  // --- Логика модалок ---
  const openInviteModal = async () => {
    if (!currentChat) return;
    try {
      const res = await api.get("/friends");
      setFriendsForInvite(res.data);
      setModalView("invite");
    } catch (e) { console.error(e); }
  };

  const openMembersModal = async () => {
    if (!currentChat) return;
    try {
      const res = await api.get(`/chats/${currentChat.id}/users`);
      setChatMembers(res.data);
      setModalView("members");
    } catch (e) { console.error(e); }
  };

  const closeModal = () => setModalView(null);

  const handleInvite = async (friendId: number) => {
    if (!currentChat) return;
    try {
      await api.post(`/chats/${currentChat.id}/invite`, { friendId });
      alert("Приглашение отправлено");
      closeModal();
    } catch (e) { console.error(e); }
  };

  const handleKick = async (userId: number) => {
    if (!currentChat) return;
    try {
      await api.post(`/chats/${currentChat.id}/kick`, { userIdToKick: userId });
      if (userId === currentUser.id) {
         setCurrentChat(null);
         fetchChats();
      } else {
         openMembersModal();
      }
      closeModal();
    } catch (e) { console.error(e); }
  };

  const handleGetInviteCode = async () => {
      if(!currentChat) return;
      try {
          const res = await api.post(`/chats/${currentChat.id}/invite-code`);
          alert(`Код приглашения: ${res.data.inviteCode}`);
      } catch(e) { console.error(e); }
  }

  // --- Эффекты ---

  useEffect(() => {
    if(currentUser) {
        fetchChats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Если сокет переподключился или обновился список чатов, нужно снова войти в комнаты
  useEffect(() => {
    if (socket && chats.length > 0) {
        chats.forEach(c => socket.emit("join_chat", c.id));
    }
  }, [socket, chats]); 

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (msg: any) => {
      console.log("📩 New message received:", msg);

      setChats((prevChats) => 
        prevChats.map(chat => 
            chat.id === msg.chat_id 
            ? { ...chat, lastMessage: msg.text } 
            : chat
        )
      );

      if (currentChat && currentChat.id === msg.chat_id) {
        setMessages((prev) => [...prev, {
            id: msg.id,
            chatId: msg.chat_id,
            senderId: msg.sender_id,
            content: msg.text,
            createdAt: msg.created_at,
            sender: {
                id: msg.sender_id,
                username: msg.sender_name || "User"
            }
        }]);
      } else {
        if (msg.sender_id !== currentUser?.id) {
            setUnreadChats((prev) => new Set(prev).add(msg.chat_id));
        }
      }
    };

    const handleMessagesCleared = (data: { chatId: number }) => {
        if (currentChat && currentChat.id === Number(data.chatId)) {
            setMessages([]);
        }
    };

    const handleChatMemberUpdated = (data: { chatId: number }) => {
        // Логика обновления участников
    };

    socket.on("new_message", handleReceiveMessage);
    socket.on("messages_cleared", handleMessagesCleared);
    socket.on("chat_member_updated", handleChatMemberUpdated);

    return () => {
      socket.off("new_message", handleReceiveMessage);
      socket.off("messages_cleared", handleMessagesCleared);
      socket.off("chat_member_updated", handleChatMemberUpdated);
    };
  }, [socket, currentChat, currentUser]);

  return (
    <ChatContext.Provider
      value={{
        chats,
        currentChat,
        messages,
        loading,
        unreadChats,
        currentUser, 
        fetchChats,
        enterChat,
        sendMessage,
        createGroupChat,
        markChatAsRead,
        deleteMessages,
        modalView,
        friendsForInvite,
        chatMembers,
        openInviteModal,
        openMembersModal,
        closeModal,
        handleInvite,
        handleKick,
        handleGetInviteCode
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};