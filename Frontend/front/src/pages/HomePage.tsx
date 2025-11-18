import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import FriendsList from "../components/FriendsList";
import ChatWindow from "../components/ChatWindow";
import { useChat } from "../context/ChatContext";
import "./HomePage.css";
import { User } from "../types";

const ChatPlaceholder = () => (
  <h3
    className="chat-placeholder"
    style={{ textAlign: "center", marginTop: "20px", color: "#aaa" }}
  >
    Выберите чат для начала общения
  </h3>
);

interface HomePageProps {
  currentUser: User | null;
}

export default function HomePage({ currentUser }: HomePageProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Исправлено: activeChat -> currentChat, selectChat -> enterChat (нет closeChat в контексте, используем setState(null) внутри контекста если нужно, но здесь enterChat переключает)
  // В ChatContext есть enterChat, но нет явного closeChat. 
  // Вы можете добавить const closeModal = () => setCurrentChat(null) в контекст, если нужно.
  // Пока используем currentChat для проверки.
  const { currentChat, enterChat } = useChat();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (location.state?.openChatId) {
      // Исправлено: передаем только ID
      enterChat(location.state.openChatId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, enterChat]);

  const handleCloseChat = () => {
    // Если нужно закрыть чат, в контексте должен быть метод для сброса currentChat.
    // Если его нет, можно перезагрузить страницу или добавить метод setCurrentChat(null) в контекст.
    // Временное решение: перезагрузка или ничего (для мобильных обычно кнопка "Назад" делает history.back)
    window.location.reload(); 
  };

  return (
    <div className={`home-page ${isMobile && currentChat ? "chat-open" : ""}`}>
      <FriendsList currentUser={currentUser} />

      <div className="chat-section">
        {currentChat ? (
          <ChatWindow isMobile={isMobile} onCloseChat={handleCloseChat} />
        ) : (
          <ChatPlaceholder />
        )}
      </div>
    </div>
  );
}