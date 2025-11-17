import React, { useEffect, useRef } from "react";
import { useChat } from "../context/ChatContext";
import "../pages/HomePage.css";

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
    <div className="chat-messages">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`message ${
            msg.sender_id === currentUser?.id
              ? "message-sender"
              : "message-receiver"
          }`}
        >
          {activeChat.is_group && msg.sender_id !== currentUser?.id && (
            <div style={{ fontSize: "0.8em", opacity: 0.7 }}>
              {msg.sender_name}
            </div>
          )}
          {msg.text}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}