import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { Chat } from "../../types";

export default function ChatManagement() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  useEffect(() => { fetchChats(); }, []);

  const fetchChats = () => {
    api
      .get<Chat[]>("/admin/chats")
      .then((res) =>
        setChats(res.data.map((c) => ({ ...c, participants: c.participants || [], messages: c.messages || [] })))
      )
      .catch(console.error);
  };

  const handleDeleteChat = async (chat: Chat) => {
    if (!window.confirm("Удалить этот чат?")) return;
    try {
      await api.delete(`/admin/chats/${chat.id}`);
      setChats((prev) => prev.filter((c) => Number(c.id) !== Number(chat.id)));
      if (selectedChat?.id === chat.id) setSelectedChat(null);
    } catch (err) { console.error("Ошибка удаления чата:", err); }
  };

  return (
    <div className="bg-discord-secondary rounded-xl p-5">
      <h3 className="text-white font-semibold text-base mb-4">Чаты</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => setSelectedChat(chat)}
            className={`p-3 rounded-xl cursor-pointer transition border ${
              selectedChat?.id === chat.id
                ? "border-discord-accent bg-discord-accent/10"
                : "border-white/10 bg-discord-tertiary hover:border-white/20"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  #{chat.id} {chat.name || (chat.is_group ? "Группа" : "ЛС")}
                </p>
                <p className="text-discord-text-muted text-xs">
                  {chat.is_group ? "Групповой" : "Личный"} · {chat.participants?.length || 0} участников
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat); }}
                className="bg-discord-danger/20 hover:bg-discord-danger text-discord-danger hover:text-white text-xs px-2 py-1 rounded transition shrink-0"
              >
                ❌
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedChat && (
        <div className="bg-discord-tertiary rounded-xl p-4">
          <h4 className="text-white font-semibold text-sm mb-3">
            Сообщения чата #{selectedChat.id}
          </h4>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {selectedChat.messages && selectedChat.messages.length > 0 ? (
              selectedChat.messages.map((m) => (
                <div key={m.id} className="flex flex-col bg-discord-secondary rounded p-2">
                  <span className="text-discord-accent text-xs font-semibold">
                    {m.sender?.username || "Unknown"}
                  </span>
                  <span className="text-discord-text-secondary text-sm">{m.text}</span>
                  <span className="text-discord-text-muted text-xs mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-discord-text-muted text-sm text-center py-4">
                Нет сообщений
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
