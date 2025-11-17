import React, { useState, useEffect } from "react";
import api from "../../services/api";
import "../../pages/AdminPage.css";
import { Chat } from "../../types";

export default function ChatManagement() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = () => {
    api
      .get<Chat[]>("/admin/chats")
      .then((res) => {
        const chatsData = res.data.map((c) => ({
          ...c,
          participants: c.participants || [],
          messages: c.messages || [],
        }));
        setChats(chatsData);
      })
      .catch((err) => console.error("Ошибка загрузки чатов:", err));
  };

  const openChat = (chatId: number) => {
    const found = chats.find((c) => Number(c.id) === Number(chatId));
    if (found) setSelectedChat(found);
  };

  const handleDeleteChat = async (chat: Chat) => {
    if (!window.confirm("Удалить этот чат?")) return;
    try {
      await api.delete(`/admin/chats/${chat.id}`);
      setChats((prev) => prev.filter((c) => Number(c.id) !== Number(chat.id)));
      if (selectedChat?.id === chat.id) setSelectedChat(null);
    } catch (err) {
      console.error("Ошибка удаления чата:", err);
    }
  };

  return (
    <div className="admin-section">
      <h3 className="admin-subtitle">Чаты</h3>
      <div className="admin-chats-list">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`admin-chat-card ${
              selectedChat?.id === chat.id ? "active" : ""
            }`}
            onClick={() => openChat(chat.id)}
          >
            <strong>
              #{chat.id}{" "}
              {chat.name ? chat.name : chat.is_group ? "Группа" : "ЛС"}
            </strong>
            <p>{chat.is_group ? "Групповой" : "Личный"}</p>
            <span>{chat.participants?.length || 0} участников</span>
            <button
              className="admin-btn delete-chat"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteChat(chat);
              }}
            >
              ❌ Удалить
            </button>
          </div>
        ))}
      </div>

      {selectedChat && (
        <div className="admin-chat-view">
          <h4>Сообщения чата #{selectedChat.id}</h4>
          <ul className="admin-chat-messages">
            {selectedChat.messages && selectedChat.messages.length > 0 ? (
              selectedChat.messages.map((m) => (
                <li key={m.id} className="admin-message">
                  <strong>{m.sender?.username || "Unknown"}:</strong> {m.text}
                  <div className="msg-time">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </li>
              ))
            ) : (
              <li className="admin-message-empty">
                Нет сообщений (или они не подгружены)
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}