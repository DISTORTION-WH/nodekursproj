import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import FriendsList from "../components/FriendsList";
import "./HomePage.css"; // Убедитесь, что стили модального окна добавлены в этот файл

export default function HomePage({ currentUser }) {
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  
  // Состояние для модального окна групп
  const [modalView, setModalView] = useState(null); // 'members' | 'invite' | null
  const [chatMembers, setChatMembers] = useState([]);
  const [friendsForInvite, setFriendsForInvite] = useState([]);
  
  // 👈 ВОЗВРАЩАЕМ СОСТОЯНИЕ ДЛЯ УДАЛЕНИЯ
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  const messagesContainerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: "Bearer " + token } };

  // ----------------- Если navigate передал chatId -----------------
  useEffect(() => {
    if (location.state?.openChatId) {
      setActiveChat({
        id: location.state.openChatId,
        username: location.state.friend?.username,
        avatar_url: location.state.friend?.avatar_url,
        is_group: false // Приватный чат из UserProfilePage
      });
    }
  }, [location.state]);

  // ----------------- Загрузка сообщений -----------------
  useEffect(() => {
    if (!activeChat) return;
    
    // Сбрасываем опции при смене чата
    setShowDeleteOptions(false);
    setModalView(null);

    const fetchMessages = () => {
      axios
        .get(`http://localhost:5000/chats/${activeChat.id}/messages`, config)
        .then((res) => setMessages(res.data))
        .catch(console.error);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [activeChat]);

  // ----------------- Загрузка участников (для групп) -----------------
  useEffect(() => {
    if (activeChat && activeChat.is_group) {
      // Используем новый эндпоинт
      axios.get(`http://localhost:5000/chats/${activeChat.id}/users`, config)
        .then(res => setChatMembers(res.data))
        .catch(console.error);
    } else {
      setChatMembers([]); // Очищаем, если это не группа
    }
  }, [activeChat]);


  // ----------------- Автопрокрутка вниз -----------------
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // ----------------- Отправка сообщения -----------------
  const sendMessage = () => {
    if (!newMessage.trim() || !activeChat?.id) return;

    axios
      .post(
        `http://localhost:5000/chats/${activeChat.id}/messages`,
        { text: newMessage },
        config
      )
      .then((res) => {
        // Бэкенд теперь возвращает готовое сообщение
        setMessages((prev) => [...prev, res.data]);
        setNewMessage("");
      })
      .catch(console.error);
  };
  
  // 👈 ВОЗВРАЩАЕМ ФУНКЦИЮ УДАЛЕНИЯ СООБЩЕНИЙ
  const deleteMessages = async (allForEveryone) => {
    if (!activeChat?.id) return;
    const confirmMsg = allForEveryone
      ? "Удалить всю переписку у всех участников?"
      : "Удалить всю переписку только у себя?";
    if (!window.confirm(confirmMsg)) return;

    try {
      await axios.post(
        `http://localhost:5000/chats/${activeChat.id}/messages/delete`,
        { allForEveryone },
        config
      );
      setMessages([]);
      setShowDeleteOptions(false);
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении сообщений");
    }
  };


  // --- Хендлеры для управления группой ---

  // 1. Открыть модальное окно участников
  const openMembersModal = () => {
    setModalView('members');
  };

  // 2. Открыть модальное окно приглашения
  const openInviteModal = async () => {
    try {
      const res = await axios.get("http://localhost:5000/friends", config);
      const friends = res.data;
      const memberIds = new Set(chatMembers.map(m => m.id));
      const friendsToInvite = friends.filter(f => !memberIds.has(f.id));
      setFriendsForInvite(friendsToInvite);
      setModalView('invite');
    } catch (err) {
      console.error("Ошибка загрузки друзей:", err);
    }
  };
  
  // 3. Закрыть модальное окно
  const closeModal = () => {
    setModalView(null);
    setFriendsForInvite([]);
  };

  // 4. Пригласить друга
  const handleInvite = async (friendId) => {
    try {
      await axios.post(
        `http://localhost:5000/chats/${activeChat.id}/invite`,
        { friendId },
        config
      );
      // Обновляем список участников
      const res = await axios.get(`http://localhost:5000/chats/${activeChat.id}/users`, config);
      setChatMembers(res.data);
      // Закрываем модалку
      closeModal();
    } catch (err) {
      console.error("Ошибка приглашения:", err);
      alert(err.response?.data?.message || "Не удалось пригласить");
    }
  };

  // 5. Кикнуть участника (или выйти из группы)
  const handleKick = async (userIdToKick) => {
    const isLeaving = currentUser.id === userIdToKick;
    const confirmMsg = isLeaving
      ? "Вы уверены, что хотите выйти из комнаты?"
      : "Вы уверены, что хотите удалить этого пользователя?";
      
    if (!window.confirm(confirmMsg)) return;

    try {
      await axios.post(
        `http://localhost:5000/chats/${activeChat.id}/kick`,
        { userIdToKick },
        config
      );
      
      if (isLeaving) {
        setActiveChat(null);
        // Перезагружаем страницу, чтобы обновить список чатов
        window.location.reload(); 
      } else {
        // Обновляем список участников в модальном окне
        setChatMembers(prev => prev.filter(m => m.id !== userIdToKick));
      }

    } catch (err) {
      console.error("Ошибка:", err);
      alert(err.response?.data?.message || "Ошибка");
    }
  };

  // 6. Получить/создать код приглашения
  const handleGetInviteCode = async () => {
    try {
      const res = await axios.post(
        `http://localhost:5000/chats/${activeChat.id}/invite-code`,
        {}, // Пустое тело
        config
      );
      
      window.prompt("Скопируйте этот код приглашения:", res.data.inviteCode);

    } catch (err) {
      console.error("Ошибка получения кода:", err);
      alert(err.response?.data?.message || "Не удалось получить код");
    }
  };

  // ----------------- Элементы сообщений -----------------
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
  
  // --- Рендер Модального Окна ---
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
      // Вид "Участники"
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
  
  // --- Рендер Главного Компонента ---
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
            // ----------------- Заголовок чата -----------------
            React.createElement(
              "div",
              { className: "chat-header" },
              !activeChat.is_group && React.createElement("img", {
                src: activeChat.avatar_url
                  ? "http://localhost:5000" + activeChat.avatar_url
                  : "/default-avatar.png",
                alt: "avatar",
                className: "chat-avatar",
              }),
              React.createElement(
                "h2",
                { className: "chat-title" },
                activeChat.username || activeChat.name
              ),
              
              // 👈 ОБНОВЛЕННЫЙ БЛОК КНОПОК ДЕЙСТВИЙ
              React.createElement(
                "div",
                { className: "chat-actions" },
                
                // --- Логика для ГРУПП ---
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
                
                // --- Логика для ЛИЧНЫХ ЧАТОВ (возвращаем удаление) ---
                !activeChat.is_group && React.createElement(
                  React.Fragment,
                  null,
                  !showDeleteOptions &&
                    React.createElement(
                      "button",
                      { onClick: () => setShowDeleteOptions(true), className: "chat-action-btn leave" }, // Используем стиль 'leave' (красный)
                      "Очистить чат"
                    ),
                  showDeleteOptions &&
                    React.createElement(
                      "div",
                      { className: "delete-options" }, // Стили для этого в HomePage.css
                      React.createElement(
                        "button",
                        { onClick: () => deleteMessages(false), className: "chat-action-btn members" }, // Синий
                        "У себя"
                      ),
                      React.createElement(
                        "button",
                        { onClick: () => deleteMessages(true), className: "chat-action-btn leave" }, // Красный
                        "У всех"
                      ),
                      React.createElement(
                        "button",
                        { onClick: () => setShowDeleteOptions(false), className: "chat-action-btn" }, // Обычный
                        "Отмена"
                      )
                    )
                )
              )
            ),

            // ----------------- Сообщения -----------------
            React.createElement(
              "div",
              { className: "chat-messages", ref: messagesContainerRef },
              ...messageElements
            ),

            // ----------------- Ввод сообщения -----------------
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
            
            // ----------------- Модальное окно -----------------
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