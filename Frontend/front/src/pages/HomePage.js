import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import FriendsList from "../components/FriendsList";
import ChatWindow from "../components/ChatWindow";
import { useChat } from "../context/ChatContext";
import "./HomePage.css";

const ChatPlaceholder = () => (
  <h3
    className="chat-placeholder"
    style={{ textAlign: "center", marginTop: "20px", color: "#aaa" }}
  >
    Выберите чат для начала общения
  </h3>
);

export default function HomePage({ currentUser }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { activeChat, selectChat } = useChat();
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
      selectChat({
        id: location.state.openChatId,
        username: location.state.friend?.username,
        avatar_url: location.state.friend?.avatar_url,
        is_group: false,
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state, selectChat]);

  const handleCloseChat = () => {
    selectChat(null);
  };

  return (
    <div className={`home-page ${isMobile && activeChat ? "chat-open" : ""}`}>
      <FriendsList currentUser={currentUser} />

      <div className="chat-section">
        {activeChat ? (
          <ChatWindow isMobile={isMobile} onCloseChat={handleCloseChat} />
        ) : (
          <ChatPlaceholder />
        )}
      </div>
    </div>
  );
}
