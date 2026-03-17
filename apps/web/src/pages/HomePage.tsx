import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import FriendsList from "../components/FriendsList";
import ChatWindow from "../components/ChatWindow";
import { useChat } from "../context/ChatContext";
import { User } from "../types";

interface HomePageProps {
  currentUser: User | null;
}

export default function HomePage({ currentUser }: HomePageProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { activeChat, selectChat, closeChat } = useChat();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
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
        name: null,
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state, selectChat]);

  return (
    <div className="flex flex-1 overflow-hidden w-full">
      {/* Sidebar - hidden on mobile when chat is open */}
      <div
        className={`${
          isMobile && activeChat ? "hidden" : "flex"
        } w-[280px] min-w-[250px] flex-col overflow-y-auto shrink-0`}
        style={{ background: "rgba(28,29,45,0.98)", transition: "all 0.3s ease" }}
      >
        <FriendsList currentUser={currentUser} />
      </div>

      {/* Chat area */}
      <div
        className={`${
          isMobile && !activeChat ? "hidden" : "flex"
        } flex-1 flex-col bg-discord-bg min-w-0`}
        style={{ transition: "all 0.3s ease" }}
      >
        {activeChat ? (
          <ChatWindow isMobile={isMobile} onCloseChat={closeChat} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: "rgba(88,101,242,0.12)", border: "1px solid rgba(88,101,242,0.2)" }}
            >
              💬
            </div>
            <p
              className="text-base font-semibold"
              style={{
                background: "linear-gradient(135deg, #ffffff, #a8b4ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Выберите чат
            </p>
            <p className="text-discord-text-muted text-sm">Откройте диалог или комнату, чтобы начать общение</p>
          </div>
        )}
      </div>
    </div>
  );
}
