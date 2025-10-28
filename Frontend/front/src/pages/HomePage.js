import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import FriendsList from "../components/FriendsList";
import "./HomePage.css";

export default function HomePage({ currentUser }) {
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  const messagesContainerRef = useRef(null);
  const location = useLocation(); // ✅ получаем данные из navigate
  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: "Bearer " + token } };

  // ----------------- Если navigate передал chatId -----------------
  useEffect(() => {
    if (location.state?.openChatId) {
      setActiveChat({
        id: location.state.openChatId,
        username: location.state.friend?.username,
        avatar_url: location.state.friend?.avatar_url,
      });
    }
  }, [location.state]);

  // ----------------- Загрузка сообщений -----------------
  useEffect(() => {
    if (!activeChat) return;

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
        setMessages((prev) => [...prev, res.data]);
        setNewMessage("");
      })
      .catch(console.error);
  };

  // ----------------- Удаление сообщений -----------------
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

  return React.createElement(
    "div",
    { className: "home-page" },
    React.createElement(FriendsList, { setActiveChat }),

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
              React.createElement("img", {
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
              React.createElement(
                "div",
                { className: "chat-actions" },
                !showDeleteOptions &&
                  React.createElement(
                    "button",
                    { onClick: () => setShowDeleteOptions(true) },
                    "Удалить чат"
                  ),
                showDeleteOptions &&
                  React.createElement(
                    "div",
                    { className: "delete-options" },
                    React.createElement(
                      "button",
                      { onClick: () => deleteMessages(false) },
                      "Удалить у себя"
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => deleteMessages(true) },
                      "Удалить у всех"
                    ),
                    React.createElement(
                      "button",
                      { onClick: () => setShowDeleteOptions(false) },
                      "Отмена"
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
            )
          )
        : React.createElement(
            "h3",
            { style: { textAlign: "center", marginTop: "20px" } },
            "Выберите чат"
          )
    )
  );
}
