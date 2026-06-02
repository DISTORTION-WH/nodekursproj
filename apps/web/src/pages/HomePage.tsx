import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FriendsList from "../components/FriendsList";
import ChatWindow from "../components/ChatWindow";
import { useChat } from "../context/ChatContext";
import { User } from "../types";
import { useI18n } from "../i18n";
import UiIcon from "../components/UiIcon";

interface HomePageProps {
  currentUser: User | null;
}

export default function HomePage({ currentUser }: HomePageProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { activeChat, selectChat, closeChat } = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const handledOpenChatId = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const openChatId = Number(location.state?.openChatId);
    if (openChatId && handledOpenChatId.current !== openChatId) {
      handledOpenChatId.current = openChatId;
      selectChat({
        id: openChatId,
        username: location.state.friend?.username,
        avatar_url: location.state.friend?.avatar_url,
        is_group: false,
        name: null,
        participants: location.state.friend?.id
          ? [{
              id: location.state.friend.id,
              username: location.state.friend.username,
              avatar_url: location.state.friend.avatar_url,
              is_banned: location.state.friend.is_banned,
            }]
          : undefined,
      });
      navigate(".", { replace: true, state: null });
    }
  }, [location.state, navigate, selectChat]);

  return (
    <div className="flex flex-1 overflow-hidden w-full">
      {/* Sidebar - hidden on mobile when chat is open */}
      <div
        className={`${
          isMobile && activeChat ? "hidden" : "flex"
        } w-[280px] min-w-[250px] flex-col overflow-y-auto shrink-0`}
        style={{ background: "var(--color-secondary)", transition: "all 0.3s ease" }}
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
              <UiIcon name="message" size={30} />
            </div>
            <p
              className="text-base font-semibold"
              style={{
                background: "linear-gradient(135deg, var(--color-text-primary), var(--color-accent))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t.common.select_chat}
            </p>
            <p className="text-discord-text-muted text-sm">{t.common.select_chat_hint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
