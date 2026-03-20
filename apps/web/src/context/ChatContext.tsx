import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import { Socket } from "socket.io-client";
import api, {
  getUnreadCounts,
  markChatAsRead,
  getPinnedMessages,
  pinMessage,
  unpinMessage,
  forwardMessage,
  getChatMessagesBefore,
  editMessage as apiEditMessage,
} from "../services/api";
import { useSocket } from "./SocketContext";
import { Chat, Message, User, ChatParticipant, ReactionGroup, UnreadCounts } from "../types";

interface ChatContextType {
  activeChat: Chat | null;
  messages: Message[];
  loadingMessages: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  modalView: "invite" | "members" | null;
  chatMembers: ChatParticipant[];
  friendsForInvite: User[];
  currentUser: User | null;
  replyingTo: Message | null;
  unreadCounts: UnreadCounts;
  typingUsers: Record<number, number[]>;
  pinnedMessages: Message[];
  forwardingMessage: Message | null;
  allChats: Chat[];

  setChatMembers: Dispatch<SetStateAction<ChatParticipant[]>>;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
  setForwardingMessage: Dispatch<SetStateAction<Message | null>>;

  selectChat: (chat: Chat) => void;
  closeChat: () => void;
  sendMessage: (text: string, replyToId?: number | null) => void;
  deleteMessages: (allForEveryone: boolean) => Promise<void>;
  openInviteModal: () => void;
  openMembersModal: () => void;
  closeModal: () => void;
  handleInvite: (friendId: number) => Promise<void>;
  handleKick: (userIdToKick: number) => Promise<void>;
  handleGetInviteCode: () => Promise<void>;
  handleEditMessage: (msgId: number, text: string) => Promise<void>;
  handlePin: (msgId: number) => Promise<void>;
  handleUnpin: (msgId: number) => Promise<void>;
  handleForward: (targetChatId: number, msg: Message) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendTyping: () => void;
  sendStopTyping: () => void;
  markAsRead: (chatId: number) => void;
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [modalView, setModalView] = useState<"invite" | "members" | null>(null);
  const [chatMembers, setChatMembers] = useState<ChatParticipant[]>([]);
  const [friendsForInvite, setFriendsForInvite] = useState<User[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [typingUsers, setTypingUsers] = useState<Record<number, number[]>>({});
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [allChats, setAllChats] = useState<Chat[]>([]);

  const activeChatRef = useRef<Chat | null>(null);
  activeChatRef.current = activeChat;

  const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load unread counts on mount
  useEffect(() => {
    if (!currentUser) return;
    getUnreadCounts()
      .then((res) => {
        const counts: UnreadCounts = {};
        for (const row of res.data) counts[row.chat_id] = row.unread;
        setUnreadCounts(counts);
      })
      .catch(console.error);
  }, [currentUser]);

  // Load all chats for ForwardModal
  useEffect(() => {
    if (!currentUser) return;
    api.get<Chat[]>("/chats")
      .then((res) => setAllChats(res.data))
      .catch(console.error);
  }, [currentUser]);

  // ── Global socket events (independent of activeChat) ─────────────────────
  useEffect(() => {
    if (!socket || !currentUser) return;

    // Added to a new group chat — refresh chat list
    const handleAddedToChat = () => {
      api.get<Chat[]>("/chats")
        .then((res) => setAllChats(res.data))
        .catch(console.error);
    };

    socket.on("added_to_chat", handleAddedToChat);
    return () => { socket.off("added_to_chat", handleAddedToChat); };
  }, [socket, currentUser]);

  const fetchChatMembers = useCallback((chatId: number) => {
    api
      .get<ChatParticipant[]>(`/chats/${chatId}/users`)
      .then((res) => setChatMembers(res.data))
      .catch(console.error);
  }, []);

  const fetchPinnedMessages = useCallback((chatId: number) => {
    getPinnedMessages(chatId)
      .then((res) => setPinnedMessages(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!socket || !activeChat?.id) return;

    setLoadingMessages(true);
    api
      .get<Message[]>(`/chats/${activeChat.id}/messages`)
      .then((res) => {
        setMessages(res.data);
        setHasMore(res.data.length >= 50);
      })
      .catch(console.error)
      .finally(() => setLoadingMessages(false));

    if (activeChat.is_group) fetchChatMembers(activeChat.id);
    fetchPinnedMessages(activeChat.id);

    socket.emit("join_chat", activeChat.id);

    const handleNewMessage = (msg: Message) => {
      const currentActiveChatId = activeChatRef.current?.id;
      if (Number(msg.chat_id) === Number(currentActiveChatId)) {
        setMessages((prev) => [...prev, msg]);
        // Mark as read since we're looking at this chat
        markChatAsRead(Number(currentActiveChatId)).catch(console.error);
      } else {
        // Increment unread
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.chat_id]: (prev[msg.chat_id] || 0) + 1,
        }));
        // Update allChats for ForwardModal refresh
        setAllChats((prev) =>
          prev.map((c) => c.id === msg.chat_id ? { ...c } : c)
        );
      }
    };

    const handleMessagesCleared = (data: { chatId: number }) => {
      const current = activeChatRef.current;
      if (current && Number(data.chatId) === Number(current.id)) setMessages([]);
    };

    const handleChatMemberUpdated = (data: { chatId: number }) => {
      const current = activeChatRef.current;
      if (current && Number(data.chatId) === Number(current.id) && current.is_group) {
        fetchChatMembers(current.id);
      }
    };

    const handleRemovedFromChat = (data: { chatId: number }) => {
      const current = activeChatRef.current;
      if (current && Number(data.chatId) === Number(current.id)) {
        alert("Вас исключили из этого чата");
        setActiveChat(null);
      }
    };

    const handleReactionUpdated = (data: { messageId: number; reactions: ReactionGroup[] }) => {
      setMessages((prev) =>
        prev.map((m) => m.id === data.messageId ? { ...m, reactions: data.reactions } : m)
      );
    };

    const handleMessageDeleted = (data: { messageId: string | number; chatId: string | number }) => {
      const current = activeChatRef.current;
      if (current && Number(data.chatId) === Number(current.id)) {
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(data.messageId)));
      }
    };

    const handleMessageEdited = (data: { messageId: number; chatId: number; text: string; edited_at: string }) => {
      const current = activeChatRef.current;
      if (current && Number(data.chatId) === Number(current.id)) {
        setMessages((prev) =>
          prev.map((m) => m.id === data.messageId ? { ...m, text: data.text, edited_at: data.edited_at } : m)
        );
      }
    };

    const handleUserTyping = (data: { chatId: number; userId: number }) => {
      const current = activeChatRef.current;
      if (current && Number(data.chatId) === Number(current.id) && data.userId !== currentUser?.id) {
        setTypingUsers((prev) => ({
          ...prev,
          [data.chatId]: Array.from(new Set([...(prev[data.chatId] || []), data.userId])),
        }));
        // Auto-clear after 3s
        const key = `${data.chatId}_${data.userId}`;
        if (typingTimeouts.current[key]) clearTimeout(typingTimeouts.current[key]);
        typingTimeouts.current[key] = setTimeout(() => {
          if (!mountedRef.current) return;
          setTypingUsers((prev) => ({
            ...prev,
            [data.chatId]: (prev[data.chatId] || []).filter((id) => id !== data.userId),
          }));
        }, 3000);
      }
    };

    const handleUserStopTyping = (data: { chatId: number; userId: number }) => {
      const current = activeChatRef.current;
      if (current && Number(data.chatId) === Number(current.id)) {
        setTypingUsers((prev) => ({
          ...prev,
          [data.chatId]: (prev[data.chatId] || []).filter((id) => id !== data.userId),
        }));
        const key = `${data.chatId}_${data.userId}`;
        if (typingTimeouts.current[key]) clearTimeout(typingTimeouts.current[key]);
      }
    };

    const handleMessagePinned = (data: { chatId: number; message: Message }) => {
      const current = activeChatRef.current;
      if (current && Number(data.chatId) === Number(current.id)) {
        setPinnedMessages((prev) => [data.message, ...prev.filter((m) => m.id !== data.message.id)]);
      }
    };

    const handleMessageUnpinned = (data: { chatId: number; messageId: number }) => {
      const current = activeChatRef.current;
      if (current && Number(data.chatId) === Number(current.id)) {
        setPinnedMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
    };

    const handleUserRenamed = (data: { userId: number; username: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          Number(m.sender_id) === Number(data.userId)
            ? { ...m, sender_name: data.username }
            : m
        )
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("messages_cleared", handleMessagesCleared);
    socket.on("chat_member_updated", handleChatMemberUpdated);
    socket.on("removed_from_chat", handleRemovedFromChat);
    socket.on("reaction_updated", handleReactionUpdated);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);
    socket.on("message_pinned", handleMessagePinned);
    socket.on("message_unpinned", handleMessageUnpinned);
    socket.on("user_renamed", handleUserRenamed);

    return () => {
      socket.emit("leave_chat", activeChat.id);
      socket.off("new_message", handleNewMessage);
      socket.off("messages_cleared", handleMessagesCleared);
      socket.off("chat_member_updated", handleChatMemberUpdated);
      socket.off("removed_from_chat", handleRemovedFromChat);
      socket.off("reaction_updated", handleReactionUpdated);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_edited", handleMessageEdited);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);
      socket.off("message_pinned", handleMessagePinned);
      socket.off("message_unpinned", handleMessageUnpinned);
      socket.off("user_renamed", handleUserRenamed);
      // Clear all pending typing timeouts
      Object.values(typingTimeouts.current).forEach(clearTimeout);
      typingTimeouts.current = {};
      if (typingDebounce.current) {
        clearTimeout(typingDebounce.current);
        typingDebounce.current = null;
      }
    };
  }, [socket, activeChat, fetchChatMembers, fetchPinnedMessages, currentUser]);

  const selectChat = (chat: Chat) => {
    setMessages([]);
    setLoadingMessages(true);
    setChatMembers([]);
    setPinnedMessages([]);
    setModalView(null);
    setReplyingTo(null);
    setHasMore(false);
    setActiveChat(chat);
    // Clear unread for this chat
    setUnreadCounts((prev) => ({ ...prev, [chat.id]: 0 }));
    markChatAsRead(chat.id).catch(console.error);
  };

  const closeChat = () => {
    setActiveChat(null);
    setReplyingTo(null);
  };

  const sendMessage = (text: string, replyToId?: number | null) => {
    if (!text.trim() || !activeChat?.id) return;
    api
      .post(`/chats/${activeChat.id}/messages`, { text, reply_to_id: replyToId ?? null })
      .catch(console.error);
  };

  const deleteMessages = async (allForEveryone: boolean) => {
    if (!activeChat?.id) return;
    if (!window.confirm(allForEveryone ? "Удалить у всех?" : "Удалить у себя?")) return;
    try {
      await api.post(`/chats/${activeChat.id}/messages/delete`, { allForEveryone });
      // Clear locally in both cases — for "all" the server broadcasts messages_cleared
      // but we optimistically clear now for immediate UI feedback
      setMessages([]);
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
    } catch (err) { console.error(err); }
  };

  const openMembersModal = () => setModalView("members");
  const closeModal = () => setModalView(null);

  const handleInvite = async (friendId: number) => {
    try {
      if (!activeChat) return;
      await api.post(`/chats/${activeChat.id}/invite`, { friendId });
      closeModal();
    } catch (err: any) { alert(err.response?.data?.message || "Ошибка"); }
  };

  const handleKick = async (userIdToKick: number) => {
    if (!activeChat || !currentUser) return;
    const isLeaving = currentUser.id === userIdToKick;
    if (!window.confirm(isLeaving ? "Выйти из группы?" : "Удалить участника?")) return;
    try {
      await api.post(`/chats/${activeChat.id}/kick`, { userIdToKick });
      if (isLeaving) closeChat();
    } catch (err: any) { alert(err.response?.data?.message || "Ошибка"); }
  };

  const handleGetInviteCode = async () => {
    try {
      if (!activeChat) return;
      const res = await api.post<{ inviteCode: string }>(`/chats/${activeChat.id}/invite-code`, {});
      window.prompt("Код приглашения:", res.data.inviteCode);
    } catch (err) { console.error(err); }
  };

  const handleEditMessage = async (msgId: number, text: string) => {
    if (!text.trim()) return;
    try {
      await apiEditMessage(msgId, text.trim());
    } catch (err) { console.error(err); }
  };

  const handlePin = async (msgId: number) => {
    if (!activeChat) return;
    try {
      await pinMessage(msgId, activeChat.id);
    } catch (err) { console.error(err); }
  };

  const handleUnpin = async (msgId: number) => {
    if (!activeChat) return;
    try {
      await unpinMessage(msgId, activeChat.id);
    } catch (err) { console.error(err); }
  };

  const handleForward = async (targetChatId: number, msg: Message) => {
    try {
      await forwardMessage(targetChatId, msg.text, msg.id);
      setForwardingMessage(null);
    } catch (err) { console.error(err); }
  };

  const loadMoreMessages = async () => {
    if (!activeChat || loadingMore || !hasMore || messages.length === 0) return;
    const oldestId = messages[0].id;
    setLoadingMore(true);
    try {
      const res = await getChatMessagesBefore(activeChat.id, oldestId);
      const older: Message[] = res.data;
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length >= 50);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const sendTyping = useCallback(() => {
    if (!socket || !activeChat?.id) return;
    if (typingDebounce.current) return; // Already sent, debounce
    socket.emit("typing", { chatId: activeChat.id });
    typingDebounce.current = setTimeout(() => {
      typingDebounce.current = null;
    }, 2000);
  }, [socket, activeChat]);

  const sendStopTyping = useCallback(() => {
    if (!socket || !activeChat?.id) return;
    if (typingDebounce.current) {
      clearTimeout(typingDebounce.current);
      typingDebounce.current = null;
    }
    socket.emit("stop_typing", { chatId: activeChat.id });
  }, [socket, activeChat]);

  const markAsRead = useCallback((chatId: number) => {
    setUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));
    markChatAsRead(chatId).catch(console.error);
  }, []);

  const value = {
    activeChat,
    messages,
    loadingMessages,
    loadingMore,
    hasMore,
    modalView,
    chatMembers,
    friendsForInvite,
    currentUser,
    replyingTo,
    unreadCounts,
    typingUsers,
    pinnedMessages,
    forwardingMessage,
    allChats,
    setChatMembers,
    setReplyingTo,
    setForwardingMessage,
    selectChat,
    closeChat,
    sendMessage,
    deleteMessages,
    openInviteModal,
    openMembersModal,
    closeModal,
    handleInvite,
    handleKick,
    handleGetInviteCode,
    handleEditMessage,
    handlePin,
    handleUnpin,
    handleForward,
    loadMoreMessages,
    sendTyping,
    sendStopTyping,
    markAsRead,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
