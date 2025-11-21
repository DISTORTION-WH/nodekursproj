import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { Chat } from "../types";

interface GroupChatListProps {
  onOpenGroupChat: (chat: Chat) => void;
}

export default function GroupChatList({ onOpenGroupChat }: GroupChatListProps) {
  const [groupChats, setGroupChats] = useState<Chat[]>([]);
  const { socket } = useSocket() as { socket: Socket | null };

  const fetchGroupChats = () => {
    api
      .get<Chat[]>("/chats")
      .then((res) => setGroupChats(res.data.filter((chat) => chat.is_group)))
      .catch(console.error);
  };

  useEffect(() => {
    fetchGroupChats();
  }, []);

  useEffect(() => {
    if (socket) {
      const onAddedToChat = () => fetchGroupChats();
      const onRemovedFromChat = (data: { chatId: number }) => {
        setGroupChats((prev) =>
          prev.filter((c) => Number(c.id) !== Number(data.chatId))
        );
      };

      socket.on("added_to_chat", onAddedToChat);
      socket.on("removed_from_chat", onRemovedFromChat);

      return () => {
        socket.off("added_to_chat", onAddedToChat);
        socket.off("removed_from_chat", onRemovedFromChat);
      };
    }
  }, [socket]);

  const joinByCode = async () => {
    const code = prompt("Код приглашения:");
    if (!code?.trim()) return;
    try {
      const res = await api.post<Chat>("/chats/join", { inviteCode: code });
      alert(`Вы вошли в: ${res.data.name}`);
      fetchGroupChats();
    } catch (err: any) {
      alert(err.response?.data?.message || "Ошибка");
    }
  };

  const createGroupChat = async () => {
    const name = prompt("Название комнаты:");
    if (!name?.trim()) return;
    try {
      const res = await api.post<Chat>("/chats/group", { name });
      setGroupChats((prev) => [...prev, res.data]);
      onOpenGroupChat(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Стили кнопок (Join / +)
  const actionBtnClass = "text-[#b9bbbe] hover:text-white cursor-pointer bg-transparent border-none p-1 transition-colors";

  return (
    <div className="flex flex-col gap-1">
      {/* Заголовок секции */}
      <div className="flex justify-between items-center mb-2 px-2">
        <h2 className="text-[#b9bbbe] text-xs font-bold uppercase m-0">Комнаты</h2>
        <div className="flex items-center gap-2">
          <button onClick={joinByCode} className={`${actionBtnClass} text-xs`} title="Вступить">
            Join
          </button>
          <button onClick={createGroupChat} className={`${actionBtnClass} text-lg leading-none`} title="Создать">
            +
          </button>
        </div>
      </div>

      {/* Список комнат */}
      {groupChats.map((chat) => (
        <div
          key={chat.id}
          className="flex items-center p-2 rounded cursor-pointer text-[#8e9297] hover:bg-[#40444b] hover:text-white transition-colors"
          onClick={() => {
            console.log("Opening group chat:", chat.id);
            onOpenGroupChat(chat);
          }}
        >
          <span className="font-medium truncate"># {chat.name}</span>
        </div>
      ))}

      {groupChats.length === 0 && (
        <p className="text-[#b9bbbe] text-xs px-2 italic">Нет комнат</p>
      )}
    </div>
  );
}