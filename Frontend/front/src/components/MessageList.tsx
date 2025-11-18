import React, { useEffect, useRef } from "react";
import { useChat } from "../context/ChatContext";
import "../pages/HomePage.css";

export default function MessageList() {
  const { messages, currentUser, currentChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [currentChat]);

  if (!currentChat) return null;

  return (
    <div className="chat-messages">
      {messages.map((msg) => {
        // Определяем ID отправителя, поддерживая и camelCase (интерфейс), и snake_case (возможный ответ API)
        const senderId = msg.senderId || (msg as any).sender_id;
        const isMyMessage = senderId === currentUser?.id;
        
        // Определяем имя отправителя
        const senderName = msg.sender?.username || (msg as any).sender_name || "User";

        return (
          <div
            key={msg.id}
            className={`message ${
              isMyMessage ? "message-sender" : "message-receiver"
            }`}
          >
            {/* Проверяем, является ли чат групповым (поддержка обоих форматов свойств) */}
            {(currentChat.isGroup || (currentChat as any).is_group) && !isMyMessage && (
              <div style={{ fontSize: "0.8em", opacity: 0.7, marginBottom: "2px" }}>
                {senderName}
              </div>
            )}
            {msg.content}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}