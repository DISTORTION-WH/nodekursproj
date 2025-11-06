import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import FriendsList from "../components/FriendsList";
import { io } from "socket.io-client"; 
import "./HomePage.css"; 

// Глобальный сокет (или тот же, что во FriendsList, если использовать Context, но пока сделаем отдельный для чата)
let chatSocket;

export default function HomePage({ currentUser }) {
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  
  const [modalView, setModalView] = useState(null); 
  const [chatMembers, setChatMembers] = useState([]);
  const [friendsForInvite, setFriendsForInvite] = useState([]);
  
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  const messagesContainerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: "Bearer " + token } };

  useEffect(() => {
    if (location.state?.openChatId) {
      setActiveChat({
        id: location.state.openChatId,
        username: location.state.friend?.username,
        avatar_url: location.state.friend?.avatar_url,
        is_group: false 
      });
    }
  }, [location.state]);

  // --- Глобальный слушатель для личных событий (кик из чата) ---
  useEffect(() => {
      if (currentUser && currentUser.id) {
          const personalSocket = io(axios.defaults.baseURL);
          personalSocket.on("connect", () => {
              personalSocket.emit('join_user_room', currentUser.id);
          });

          // Если нас кикнули, и мы в этом чате -> выходим на главную
          personalSocket.on('removed_from_chat', (data) => {
              if (activeChat && Number(activeChat.id) === Number(data.chatId)) {
                  alert("Вас исключили из этого чата");
                  setActiveChat(null);
              }
          });

          return () => personalSocket.disconnect();
      }
  }, [currentUser, activeChat]);


  // ----------------- Активный чат -----------------
  useEffect(() => {
    if (!activeChat?.id) return;
    
    setShowDeleteOptions(false);
    setModalView(null);

    // Загрузка истории
    axios
      .get(`/chats/${activeChat.id}/messages`, config)
      .then((res) => setMessages(res.data))
      .catch(console.error);

    // Подключение к сокету ЧАТА
    chatSocket = io(axios.defaults.baseURL);
    
    chatSocket.on("connect", () => {
        chatSocket.emit("join_chat", activeChat.id);
    });

    // Новое сообщение
    chatSocket.on("new_message", (msg) => {
        if (Number(msg.chat_id) === Number(activeChat.id)) {
             setMessages((prev) => [...prev, msg]);
        }
    });

    // История очищена
    chatSocket.on("messages_cleared", (data) => {
        if (Number(data.chatId) === Number(activeChat.id)) {
            setMessages([]);
        }
    });

    // Обновление участников (кто-то вошел, вышел, кикнут)
    chatSocket.on("chat_member_updated", (data) => {
        if (Number(data.chatId) === Number(activeChat.id)) {
             // Перезагружаем список участников, если открыто модальное окно
             axios.get(`/chats/${activeChat.id}/users`, config)
                .then(res => setChatMembers(res.data))
                .catch(console.error);
        }
    });

    return () => {
      if (chatSocket) chatSocket.disconnect();
    };
  }, [activeChat]);

  // Загрузка участников при открытии чата (если группа)
  useEffect(() => {
    if (activeChat && activeChat.is_group) {
      axios.get(`/chats/${activeChat.id}/users`, config) 
        .then(res => setChatMembers(res.data))
        .catch(console.error);
    } else {
      setChatMembers([]); 
    }
  }, [activeChat]);


  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !activeChat?.id) return;

    axios
      .post(
        `/chats/${activeChat.id}/messages`, 
        { text: newMessage },
        config
      )
      .then(() => {
        setNewMessage("");
      })
      .catch(console.error);
  };
  
  const deleteMessages = async (allForEveryone) => {
    if (!activeChat?.id) return;
    const confirmMsg = allForEveryone
      ? "Удалить всю переписку у всех участников?"
      : "Удалить всю переписку только у себя?";
    if (!window.confirm(confirmMsg)) return;

    try {
      await axios.post(
        `/chats/${activeChat.id}/messages/delete`, 
        { allForEveryone },
        config
      );
      if (!allForEveryone) {
           setMessages([]); // Если только у себя, чистим локально сразу
      }
      setShowDeleteOptions(false);
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении сообщений");
    }
  };

  const openMembersModal = () => {
    setModalView('members');
  };

  const openInviteModal = async () => {
    try {
      const res = await axios.get("/friends", config); 
      const friends = res.data;
      const memberIds = new Set(chatMembers.map(m => m.id));
      const friendsToInvite = friends.filter(f => !memberIds.has(f.id));
      setFriendsForInvite(friendsToInvite);
      setModalView('invite');
    } catch (err) {
      console.error("Ошибка загрузки друзей:", err);
    }
  };
  
  const closeModal = () => {
    setModalView(null);
    setFriendsForInvite([]);
  };

  const handleInvite = async (friendId) => {
    try {
      await axios.post(
        `/chats/${activeChat.id}/invite`, 
        { friendId },
        config
      );
      // Список участников обновится через сокет, но можно и принудительно закрыть модалку
      closeModal();
    } catch (err) {
      console.error("Ошибка приглашения:", err);
      alert(err.response?.data?.message || "Не удалось пригласить");
    }
  };

  const handleKick = async (userIdToKick) => {
    const isLeaving = currentUser.id === userIdToKick;
    const confirmMsg = isLeaving
      ? "Вы уверены, что хотите выйти из комнаты?"
      : "Вы уверены, что хотите удалить этого пользователя?";
      
    if (!window.confirm(confirmMsg)) return;

    try {
      await axios.post(
        `/chats/${activeChat.id}/kick`, 
        { userIdToKick },
        config
      );
      
      if (isLeaving) {
        setActiveChat(null);
        // Не перезагружаем страницу целиком, FriendsList сам обновится через сокет 'removed_from_chat'
      } 
      // Если кикнули другого, список участников обновится через сокет 'chat_member_updated'

    } catch (err) {
      console.error("Ошибка:", err);
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
      
      window.prompt("Скопируйте этот код приглашения:", res.data.inviteCode);

    } catch (err) {
      console.error("Ошибка получения кода:", err);
      alert(err.response?.data?.message || "Не удалось получить код");
    }
  };

  const messageElements = messages.map((msg) =>
    React.createElement(
      "div",
      {
        key: msg.id,
        className:
          "message " +
          (msg.sender_id === currentUser?.id
            ? "message-sender"
            : "message-receiver") +
          " fade-in",
      },
      `${msg.sender_name}: ${msg.text}`
    )
  );
  
  const renderModal = () => {
    if (!modalView) return null;

    const isInviteView = modalView === 'invite';
    const title = isInviteView ? "Пригласить друзей" : "Участники комнаты";
    
    let listElements;
    
    if (isInviteView) {
      listElements = friendsForInvite.length > 0
        ? friendsForInvite.map(friend => React.createElement(
            "div", { key: friend.id, className: "modal-item" },
            React.createElement("span", null, friend.username),
            React.createElement("button", { 
              className: "modal-btn invite",
              onClick: () => handleInvite(friend.id)
            }, "Пригласить")
          ))
        : React.createElement("p", null, "Все ваши друзья уже в чате.");
    } else {
      listElements = chatMembers.map(member => {
        const isCreator = activeChat.creator_id === member.id;
        const canKick = (activeChat.creator_id === currentUser.id && member.id !== currentUser.id) || 
                        (member.invited_by_user_id === currentUser.id);

        return React.createElement(
          "div", { key: member.id, className: "modal-item" },
          React.createElement("span", null, 
            `${member.username} ${isCreator ? "(👑 Создатель)" : ""}`
          ),
          canKick && React.createElement("button", {
            className: "modal-btn kick",
            onClick: () => handleKick(member.id)
          }, "Удалить")
        );
      });
    }

    let modalFooter = null;
    if (modalView === 'members') {
      modalFooter = React.createElement(
          "div", { className: "modal-footer" },
          React.createElement("button", {
            className: "modal-btn invite",
            onClick: handleGetInviteCode
          }, "Получить код приглашения")
        );
    }

    return React.createElement(
      "div", { className: "modal-backdrop", onClick: closeModal },
      React.createElement(
        "div", { className: "modal-content", onClick: e => e.stopPropagation() },
        React.createElement(
          "div", { className: "modal-header" },
          React.createElement("h3", { className: "modal-title" }, title),
          React.createElement("button", { className: "modal-close-btn", onClick: closeModal }, "×")
        ),
        React.createElement("div", { className: "modal-body" }, listElements),
        modalFooter
      )
    );
  };
  
  return React.createElement(
    "div",
    { className: "home-page" },
    React.createElement(FriendsList, { 
      setActiveChat: setActiveChat, 
      currentUser: currentUser 
    }),

    React.createElement(
      "div",
      { className: "chat-section" },
      activeChat
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "div",
              { className: "chat-header" },
              !activeChat.is_group && React.createElement("img", {
                src: activeChat.avatar_url
                 ? axios.defaults.baseURL + activeChat.avatar_url
                 : "/default-avatar.png",
                alt: "avatar",
                className: "chat-avatar",
              }),
              React.createElement(
                "h2",
                { className: "chat-title" },
                activeChat.username || activeChat.name
              ),
              
              React.createElement(
                "div",
                { className: "chat-actions" },
                
                activeChat.is_group && React.createElement(
                  React.Fragment,
                  null,
                   React.createElement(
                    "button",
                    { onClick: openInviteModal, className: "chat-action-btn invite" },
                    "Пригласить"
                  ),
                   React.createElement(
                    "button",
                    { onClick: openMembersModal, className: "chat-action-btn members" },
                    "Участники"
                  ),
                  React.createElement(
                    "button",
                    { onClick: () => handleKick(currentUser.id), className: "chat-action-btn leave" },
                    "Выйти"
                  )
                ),
                
                !activeChat.is_group && React.createElement(
                  React.Fragment,
                  null,
                  !showDeleteOptions &&
                    React.createElement(
                      "button",
                      { onClick: () => setShowDeleteOptions(true), className: "chat-action-btn leave" }, 
                      "Очистить чат"
                    ),
                  showDeleteOptions &&
                    React.createElement(
                      "div",
                      { className: "delete-options" }, 
                      React.createElement(
                        "button",
                        { onClick: () => deleteMessages(false), className: "chat-action-btn members" }, 
                        "У себя"
                      ),
                      React.createElement(
                        "button",
                        { onClick: () => deleteMessages(true), className: "chat-action-btn leave" }, 
                        "У всех"
                      ),
                     React.createElement(
                        "button",
                        { onClick: () => setShowDeleteOptions(false), className: "chat-action-btn" }, 
                        "Отмена"
                      )
                    )
                )
              )
            ),

            React.createElement(
              "div",
              { className: "chat-messages", ref: messagesContainerRef },
              ...messageElements
            ),

            React.createElement(
              "div",
              { className: "chat-input" },
              React.createElement("input", {
                value: newMessage,
                onChange: (e) => setNewMessage(e.target.value),
                placeholder: "Введите сообщение...",
                onKeyDown: (e) => e.key === "Enter" && sendMessage(),
              }),
              React.createElement(
                "button",
                { onClick: sendMessage },
                "Отправить"
              )
            ),
            
            renderModal()
          )
        : React.createElement(
            "h3",
            { style: { textAlign: "center", marginTop: "20px" } },
            "Выберите или создайте чат"
          )
    )
  );
}