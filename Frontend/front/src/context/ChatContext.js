import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { useSocket } from "./SocketContext";

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ currentUser, children }) => {
  const { socket } = useSocket();
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [modalView, setModalView] = useState(null);
  const [chatMembers, setChatMembers] = useState([]);
  const [friendsForInvite, setFriendsForInvite] = useState([]);

  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: `Bearer ${token}` } };

  const fetchChatMembers = useCallback(
    (chatId) => {
      axios
        .get(`/chats/${chatId}/users`, config)
        .then((res) => setChatMembers(res.data))
        .catch(console.error);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token]
  );

  useEffect(() => {
    if (!socket || !activeChat?.id) {
      return;
    }

    axios
      .get(`/chats/${activeChat.id}/messages`, config)
      .then((res) => setMessages(res.data))
      .catch(console.error);

    if (activeChat.is_group) {
      fetchChatMembers(activeChat.id);
    }

    socket.emit("join_chat", activeChat.id);
    console.log(`Socket: Вступил в комнату chat_${activeChat.id}`);

    const handleNewMessage = (msg) => {
      if (Number(msg.chat_id) === Number(activeChat.id)) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleMessagesCleared = (data) => {
      if (Number(data.chatId) === Number(activeChat.id)) {
        setMessages([]);
      }
    };

    const handleChatMemberUpdated = (data) => {
      if (
        Number(data.chatId) === Number(activeChat.id) &&
        activeChat.is_group
      ) {
        fetchChatMembers(activeChat.id);
      }
    };

    const handleRemovedFromChat = (data) => {
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
      console.log(`Socket: Покинул комнату chat_${activeChat.id}`);
      socket.emit("leave_chat", activeChat.id);
      socket.off("new_message", handleNewMessage);
      socket.off("messages_cleared", handleMessagesCleared);
      socket.off("chat_member_updated", handleChatMemberUpdated);
      socket.off("removed_from_chat", handleRemovedFromChat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, activeChat, fetchChatMembers]);

  const selectChat = (chat) => {
    setMessages([]);
    setChatMembers([]);
    setModalView(null);
    setActiveChat(chat);
  };

  const closeChat = () => {
    setActiveChat(null);
  };

  const sendMessage = (text) => {
    if (!text.trim() || !activeChat?.id) return;
    axios
      .post(`/chats/${activeChat.id}/messages`, { text }, config)
      .catch(console.error);
  };

  const deleteMessages = async (allForEveryone) => {
    if (!activeChat?.id) return;
    if (!window.confirm(allForEveryone ? "Удалить у всех?" : "Удалить у себя?"))
      return;
    try {
      await axios.post(
        `/chats/${activeChat.id}/messages/delete`,
        { allForEveryone },
        config
      );
      if (!allForEveryone) setMessages([]);
    } catch (err) {
      console.error(err);
    }
  };

  const openInviteModal = async () => {
    try {
      const res = await axios.get("/friends", config);
      const memberIds = new Set(chatMembers.map((m) => m.id));
      setFriendsForInvite(res.data.filter((f) => !memberIds.has(f.id)));
      setModalView("invite");
    } catch (err) {
      console.error(err);
    }
  };

  const openMembersModal = () => {
    setModalView("members");
  };

  const closeModal = () => {
    setModalView(null);
  };

  const handleInvite = async (friendId) => {
    try {
      await axios.post(`/chats/${activeChat.id}/invite`, { friendId }, config);
      closeModal();
    } catch (err) {
      alert(err.response?.data?.message || "Ошибка");
    }
  };

  const handleKick = async (userIdToKick) => {
    const isLeaving = currentUser.id === userIdToKick;
    if (!window.confirm(isLeaving ? "Выйти из группы?" : "Удалить участника?"))
      return;
    try {
      await axios.post(
        `/chats/${activeChat.id}/kick`,
        { userIdToKick },
        config
      );
      if (isLeaving) closeChat();
    } catch (err) {
      alert(err.response?.data?.message || "Ошибка");
    }
  };

  const handleGetInviteCode = async () => {
    try {
      const res = await axios.post(
        `/chats/${activeChat.id}/invite-code`,
        {},
        config
      );
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
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
