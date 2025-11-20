import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Socket } from "socket.io-client"; 
import api from "../services/api";
import { useSocket } from "./SocketContext";
import { Chat, Message, User, ChatParticipant } from "../types";

interface ChatContextType {
  activeChat: Chat | null;
  messages: Message[];
  modalView: "invite" | "members" | null;
  chatMembers: ChatParticipant[];
  friendsForInvite: User[];
  currentUser: User | null;
  friends: User[]; 
  onlineUsers: Set<number>; 
  
  setActiveChat: (chat: Chat | null) => void; 
  selectChat: (chat: Chat) => void;
  closeChat: () => void;
  startPrivateChat: (friendId: number) => Promise<void>; 
  openGroupChat: (chat: Chat) => void; 
  
  sendMessage: (text: string) => void;
  deleteMessages: (allForEveryone: boolean) => Promise<void>;
  
  openInviteModal: () => void;
  openMembersModal: () => void;
  closeModal: () => void;
  handleInvite: (friendId: number) => Promise<void>;
  handleKick: (userIdToKick: number) => Promise<void>;
  handleGetInviteCode: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};

interface ChatProviderProps {
  currentUser: User | null;
  children: ReactNode;
}

export const ChatProvider = ({ currentUser, children }: ChatProviderProps) => {
  const { socket } = useSocket() as { socket: Socket | null };
  
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [modalView, setModalView] = useState<"invite" | "members" | null>(null);
  const [chatMembers, setChatMembers] = useState<ChatParticipant[]>([]);
  const [friendsForInvite, setFriendsForInvite] = useState<User[]>([]);
  
  const [friends, setFriends] = useState<User[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (currentUser) {
        api.get<User[]>("/friends")
           .then(res => setFriends(res.data || []))
           .catch(console.error);
    }
  }, [currentUser]);

  const fetchChatMembers = useCallback((chatId: number) => {
    api
      .get<ChatParticipant[]>(`/chats/${chatId}/users`)
      .then((res) => setChatMembers(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!socket || !activeChat?.id) return;

    api
      .get<Message[]>(`/chats/${activeChat.id}/messages`)
      .then((res) => setMessages(res.data))
      .catch(console.error);

    if (activeChat.is_group) {
      fetchChatMembers(activeChat.id);
    }

    socket.emit("join_chat", activeChat.id);

    const handleNewMessage = (msg: Message) => {
      if (Number(msg.chat_id) === Number(activeChat.id)) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleMessagesCleared = (data: { chatId: number }) => {
      if (Number(data.chatId) === Number(activeChat.id)) {
        setMessages([]);
      }
    };

    const handleChatMemberUpdated = (data: { chatId: number }) => {
      if (Number(data.chatId) === Number(activeChat.id) && activeChat.is_group) {
        fetchChatMembers(activeChat.id);
      }
    };

    const handleRemovedFromChat = (data: { chatId: number }) => {
      if (Number(data.chatId) === Number(activeChat.id)) {
        alert("Вас исключили из этого чата");
        setActiveChat(null);
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("messages_cleared", handleMessagesCleared);
    socket.on("chat_member_updated", handleChatMemberUpdated);
    socket.on("removed_from_chat", handleRemovedFromChat);

    return () => {
      socket.emit("leave_chat", activeChat.id);
      socket.off("new_message", handleNewMessage);
      socket.off("messages_cleared", handleMessagesCleared);
      socket.off("chat_member_updated", handleChatMemberUpdated);
      socket.off("removed_from_chat", handleRemovedFromChat);
    };
  }, [socket, activeChat, fetchChatMembers]);

  useEffect(() => {
    if (!socket) return;

    const onOnlineUsers = (userIds: number[]) => {
        setOnlineUsers(new Set(userIds));
    };
    const onUserConnected = (userId: number) => {
        setOnlineUsers(prev => new Set(prev).add(userId));
    };
    const onUserDisconnected = (userId: number) => {
        setOnlineUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
        });
    };

    socket.emit("get_online_users"); 

    socket.on("online_users", onOnlineUsers); 
    socket.on("user_connected", onUserConnected);
    socket.on("user_disconnected", onUserDisconnected);

    return () => {
        socket.off("online_users", onOnlineUsers);
        socket.off("user_connected", onUserConnected);
        socket.off("user_disconnected", onUserDisconnected);
    };
  }, [socket]);


  const selectChat = (chat: Chat) => {
    setMessages([]);
    setChatMembers([]);
    setModalView(null);
    setActiveChat(chat);
  };

  const openGroupChat = (chat: Chat) => {
      selectChat(chat);
  };

  const closeChat = () => {
    setActiveChat(null);
  };

  const startPrivateChat = async (friendId: number) => {
    try {
        const res = await api.post<{id: number}>("/chats/private", { friendId });

        const chatRes = await api.get<Chat>(`/chats/${res.data.id}`);
        selectChat(chatRes.data);
    } catch (e) {
        console.error(e);
    }
  };

  const sendMessage = (text: string) => {
    if (!text.trim() || !activeChat?.id) return;
    api.post(`/chats/${activeChat.id}/messages`, { text }).catch(console.error);
  };

  const deleteMessages = async (allForEveryone: boolean) => {
    if (!activeChat?.id) return;
    if (!window.confirm(allForEveryone ? "Удалить у всех?" : "Удалить у себя?"))
      return;
    try {
      await api.post(`/chats/${activeChat.id}/messages/delete`, { allForEveryone });
      if (!allForEveryone) setMessages([]);
    } catch (err) {
      console.error(err);
    }
  };

  const openInviteModal = async () => {
    try {
      const res = await api.get<User[]>("/friends");
      const memberIds = new Set(chatMembers.map((m) => m.id));
      setFriendsForInvite(res.data.filter((f) => !memberIds.has(f.id)));
      setModalView("invite");
    } catch (err) {
      console.error(err);
    }
  };

  const openMembersModal = () => setModalView("members");
  const closeModal = () => setModalView(null);

  const handleInvite = async (friendId: number) => {
    try {
      if (!activeChat) return;
      await api.post(`/chats/${activeChat.id}/invite`, { friendId });
      closeModal();
    } catch (err: any) {
      alert(err.response?.data?.message || "Ошибка");
    }
  };

  const handleKick = async (userIdToKick: number) => {
    if (!activeChat || !currentUser) return;
    const isLeaving = currentUser.id === userIdToKick;
    if (!window.confirm(isLeaving ? "Выйти из группы?" : "Удалить участника?")) return;
    try {
      await api.post(`/chats/${activeChat.id}/kick`, { userIdToKick });
      if (isLeaving) closeChat();
    } catch (err: any) {
      alert(err.response?.data?.message || "Ошибка");
    }
  };

  const handleGetInviteCode = async () => {
    try {
      if (!activeChat) return;
      const res = await api.post<{ inviteCode: string }>(`/chats/${activeChat.id}/invite-code`, {});
      window.prompt("Код приглашения:", res.data.inviteCode);
    } catch (err) {
      console.error(err);
    }
  };

  const value = {
    activeChat,
    messages,
    modalView,
    chatMembers,
    friendsForInvite,
    currentUser,
    friends,
    onlineUsers,
    setActiveChat,
    selectChat,
    closeChat,
    startPrivateChat,
    openGroupChat,
    sendMessage,
    deleteMessages,
    openInviteModal,
    openMembersModal,
    closeModal,
    handleInvite,
    handleKick,
    handleGetInviteCode,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};