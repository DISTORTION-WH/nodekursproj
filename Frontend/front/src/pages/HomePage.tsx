import React, { useEffect, useState } from "react";
import FriendsList from "../components/FriendsList";
import ChatWindow from "../components/ChatWindow";
import { useChat } from "../context/ChatContext";
import { User } from "../types";

const ChatPlaceholder = () => (
  <div className="flex-1 flex items-center justify-center text-[#b9bbbe] flex-col p-5 text-center h-full">
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

  const contentTransformClass = (isMobile && activeChat) 
    ? "-translate-x-full" 
    : "translate-x-0";

  return (
    <div className="flex w-full h-full bg-bg overflow-hidden relative">
      <div 
        className={`
          w-[280px] h-full bg-bg shrink-0 transition-transform duration-300 ease-in-out z-10
          md:w-full md:absolute md:top-0 md:left-0
          ${contentTransformClass}
        `}
      >
         <FriendsList currentUser={currentUser} />
      </div>

      <div 
        className={`
          flex-1 flex flex-col h-full min-w-0 relative bg-[#36393f] transition-transform duration-300 ease-in-out
          md:w-full md:absolute md:top-0 md:left-full
          ${contentTransformClass}
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