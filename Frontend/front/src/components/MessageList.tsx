import React, { useEffect, useRef } from "react";
import { useChat } from "../context/ChatContext";

export default function MessageList() {
  const { messages, currentUser, activeChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [activeChat]);

  if (!activeChat) return null;

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-[#36393f] flex flex-col gap-1 scrollbar-thin">
      {messages.map((msg) => {
        const isMe = msg.sender_id === currentUser?.id;
        return (
          <div
            key={msg.id}
            className={`
              max-w-[70%] py-2 px-3 rounded-lg text-white relative break-words leading-snug
              ${isMe 
                ? "self-end bg-accent rounded-br-none" 
                : "self-start bg-[#40444b] rounded-bl-none"
              }
            `}
          >
            {activeChat.is_group && !isMe && (
              <div className="text-xs opacity-70 font-bold mb-1 text-[#aab0b8]">
                {msg.sender_name}
              </div>
            )}
            {msg.text}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}