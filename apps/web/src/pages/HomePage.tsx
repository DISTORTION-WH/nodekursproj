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
        } w-[280px] min-w-[250px] flex-col bg-discord-secondary overflow-y-auto shrink-0`}
      >
        <FriendsList currentUser={currentUser} />
      </div>

      {/* Chat area */}
      <div
        className={`${
          isMobile && !activeChat ? "hidden" : "flex"
        } flex-1 flex-col bg-discord-bg min-w-0`}
      >
        {activeChat ? (
          <ChatWindow isMobile={isMobile} onCloseChat={closeChat} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-discord-text-muted">
            Выберите чат для начала общения
          </div>
        )}
      </div>
    </div>
  );
}
