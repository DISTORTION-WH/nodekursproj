import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { Chat } from "../../types";

export default function ChatManagement() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = () => {
    api.get<Chat[]>("/admin/chats")
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
    <div className="bg-[#202225] p-5 rounded-xl mb-5 md:p-4">
      <h3 className="text-xl mb-4">Чаты</h3>
      <div className="flex flex-wrap gap-3">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`
              bg-white/5 p-4 rounded-lg flex-auto min-w-[200px] max-w-[300px] cursor-pointer transition-all flex flex-col gap-1.5
              hover:bg-white/10 hover:-translate-y-1
              ${selectedChat?.id === chat.id ? "border-2 border-accent" : ""}
            `}
            onClick={() => openChat(chat.id)}
          >
            <strong>
              #{chat.id}{" "}
              {chat.name ? chat.name : chat.is_group ? "Группа" : "ЛС"}
            </strong>
            <p className="m-0 text-sm text-[#b9bbbe]">{chat.is_group ? "Групповой" : "Личный"}</p>
            <span className="text-xs text-[#b9bbbe]">{chat.participants?.length || 0} участников</span>
            <button
              className="mt-2.5 self-start bg-danger text-white border-none p-1.5 px-2 rounded text-xs cursor-pointer hover:bg-danger-hover"
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
        <div className="mt-5 p-4 rounded-lg bg-black/20 max-h-[500px] flex flex-col">
          <h4 className="m-0 mb-2.5">Сообщения чата #{selectedChat.id}</h4>
          <ul className="list-none p-0 m-0 overflow-y-auto flex-1">
            {selectedChat.messages && selectedChat.messages.length > 0 ? (
              selectedChat.messages.map((m) => (
                <li key={m.id} className="p-2 border-b border-white/5 last:border-none">
                  <strong>{m.sender?.username || "Unknown"}:</strong> {m.text}
                  <div className="text-xs text-[#b9bbbe] mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </li>
              ))
            ) : (
              <li className="text-[#b9bbbe] text-center p-5">
                Нет сообщений (или они не подгружены)
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}