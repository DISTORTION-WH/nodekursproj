import React, { useEffect, useRef } from "react";
import { useChat } from "../context/ChatContext";
import { deleteMessage, reportMessage } from "../services/api"; //
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

  // Логика отправки жалобы
  const handleReport = async (msgId: number) => {
    const reason = window.prompt("Укажите причину жалобы:");
    if (!reason) return; // Если отмена или пусто

    try {
        await reportMessage(msgId, reason);
        alert("Жалоба отправлена модераторам.");
    } catch(e) {
        console.error(e);
        alert("Ошибка отправки жалобы");
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
            
            {/* Контейнер для кнопок действий */}
            <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '10px', gap: '5px' }}>
                
                {/* Кнопка репорта: показываем только если сообщение НЕ наше */}
                {!isMine && (
                    <button 
                        onClick={() => handleReport(msg.id)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: 0.6,
                            fontSize: '14px',
                            padding: 0
                        }}
                        title="Пожаловаться"
                    >
                        🚩
                    </button>
                )}

                {/* Кнопка удаления: показываем автору или модератору */}
                {canDelete && (
                    <button 
                        onClick={() => handleDelete(msg.id)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'red',
                            cursor: 'pointer',
                            opacity: 0.6,
                            fontSize: '14px',
                            padding: 0
                        }}
                        title="Удалить"
                    >
                        🗑️
                    </button>
                )}
            </span>

            </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}