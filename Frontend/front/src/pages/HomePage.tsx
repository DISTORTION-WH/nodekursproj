import React, { useEffect, useState } from "react";
import FriendsList from "../components/FriendsList";
import ChatWindow from "../components/ChatWindow";
import { useChat } from "../context/ChatContext";
import { User } from "../types";

const ChatPlaceholder = () => (
  <div className="flex-1 flex items-center justify-center text-[#b9bbbe] flex-col p-5 text-center h-full bg-[#36393f]">
    <h2 className="text-2xl mb-2.5 font-bold text-white">Добро пожаловать в Lume!</h2>
    <p>Выберите друга или чат слева, чтобы начать общение.</p>
  </div>
);

interface HomePageProps {
  currentUser: User | null;
}

export default function HomePage({ currentUser }: HomePageProps) {
  const { activeChat, closeChat } = useChat();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Логика CSS-трансформации для мобильной навигации
  // Если мобильный и чат открыт -> сдвигаем всё влево на 100%
  const mobileTranslateClass = (isMobile && activeChat) ? "-translate-x-full" : "translate-x-0";

  return (
    <div className="flex w-full h-full bg-[#36393f] overflow-hidden relative">
      
      {/* ЛЕВАЯ КОЛОНКА (Список друзей) */}
      {/* Mobile (default): absolute, width 100%, z-index 10. 
         Desktop (md): relative, width 280px, z-index 0, всегда на месте (translate-x-0).
      */}
      <div 
        className={`
          absolute top-0 left-0 w-full h-full bg-bg z-10 transition-transform duration-300 ease-in-out
          md:relative md:w-[280px] md:translate-x-0 md:z-0 md:border-r md:border-[#202225] md:shrink-0
          ${mobileTranslateClass}
        `}
      >
         <FriendsList currentUser={currentUser} />
      </div>

      {/* ПРАВАЯ КОЛОНКА (Чат) */}
      {/* Mobile (default): absolute, width 100%, left 100% (справа за экраном).
         Desktop (md): relative, flex-1, left 0 (на своем месте).
      */}
      <div 
        className={`
          absolute top-0 left-full w-full h-full bg-[#36393f] transition-transform duration-300 ease-in-out
          md:relative md:left-0 md:flex-1 md:w-auto md:translate-x-0
          ${mobileTranslateClass}
        `}
      >
        {activeChat ? (
          <ChatWindow isMobile={isMobile} onCloseChat={closeChat} />
        ) : (
          <ChatPlaceholder />
        )}
      </div>
    </div>
  );
}