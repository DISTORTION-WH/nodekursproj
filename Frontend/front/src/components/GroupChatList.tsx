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
      const onAddedToChat = () => { fetchGroupChats(); };
      const onRemovedFromChat = (data: { chatId: number }) => {
        setGroupChats((prev) => prev.filter((c) => Number(c.id) !== Number(data.chatId)));
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

  const btnClass = "bg-transparent border-none text-text-muted cursor-pointer text-lg p-1 hover:text-white transition-colors";

  return (
    <div className="p-4 border-b border-bg-block md:p-2.5 md:px-4">
      <div className="flex justify-between items-center mb-2.5 text-text-muted text-sm uppercase font-bold">
        <h2>Комнаты</h2>
        <div className="flex gap-2">
          <button onClick={joinByCode} className={btnClass} title="Вступить по коду">
            Join
          </button>
          <button onClick={createGroupChat} className={`${btnClass} text-xl font-bold`} title="Создать">
            +
          </button>
        </div>
      </div>
      {groupChats.map((chat) => (
        <div
          key={chat.id}
          className="flex items-center p-2 rounded cursor-pointer transition-colors text-[#8e9297] mb-0.5 hover:bg-bg-hover hover:text-white"
          onClick={() => onOpenGroupChat(chat)}
        >
          <span className="font-medium overflow-hidden text-ellipsis whitespace-nowrap"># {chat.name}</span>
        </div>
      ))}
      {groupChats.length === 0 && <p className="text-text-muted text-sm italic">Нет комнат</p>}
    </div>
  );
}