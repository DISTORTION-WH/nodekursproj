import React, { useEffect, useRef } from "react";
import { useChat } from "../context/ChatContext";
import { deleteMessage } from "../services/api";
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

  const handleDelete = async (msgId: number) => {
    if(!window.confirm("Удалить сообщение?")) return;
    try {
        await deleteMessage(msgId);
    } catch(e) {
        console.error(e);
        alert("Ошибка удаления");
    }
  };

  if (!activeChat) return null;

  const isModerator = currentUser?.roles?.includes('MODERATOR') || currentUser?.roles?.includes('ADMIN');

  return (
    <div className="chat-messages">
      {messages.map((msg) => {
        const isMine = msg.sender_id === currentUser?.id;
        const canDelete = isMine || isModerator;

        return (
            <div
            key={msg.id}
            className={`message ${
                isMine
                ? "message-sender"
                : "message-receiver"
            }`}
            >
            {activeChat.is_group && !isMine && (
                <div style={{ fontSize: "0.8em", opacity: 0.7 }}>
                {msg.sender_name}
                </div>
            )}
            {msg.text}
            
            {canDelete && (
                <button 
                    onClick={() => handleDelete(msg.id)}
                    style={{
                        marginLeft: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: 'red',
                        cursor: 'pointer',
                        opacity: 0.5,
                        fontSize: '12px'
                    }}
                    title="Удалить"
                >
                    🗑️
                </button>
            )}
            </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}