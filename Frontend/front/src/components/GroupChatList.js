import React, { useState, useEffect } from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";

export default function GroupChatList({ onOpenGroupChat }) {
  const [groupChats, setGroupChats] = useState([]);
  const { socket } = useSocket();

  const fetchGroupChats = () => {
    api
      .get("/chats")
      .then((res) => setGroupChats(res.data.filter((chat) => chat.is_group)))
      .catch(console.error);
  };

  useEffect(() => {
    fetchGroupChats();
  }, []);

  useEffect(() => {
    if (socket) {
      const onAddedToChat = () => {
        fetchGroupChats();
      };
      const onRemovedFromChat = (data) => {
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
      const res = await api.post("/chats/join", { inviteCode: code });
      alert(`Вы вошли в: ${res.data.name}`);
      fetchGroupChats();
    } catch (err) {
      alert(err.response?.data?.message || "Ошибка");
    }
  };

  const createGroupChat = async () => {
    const name = prompt("Название комнаты:");
    if (!name?.trim()) return;
    try {
      const res = await api.post("/chats/group", { name });
      setGroupChats((prev) => [...prev, res.data]);
      onOpenGroupChat(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="friends-section">
      <div className="section-header">
        <h2>Комнаты</h2>
        <div className="section-header-actions">
          <button onClick={joinByCode} className="group-action-btn">
            Join
          </button>

          <button onClick={createGroupChat} className="group-action-btn create">
            +
          </button>
        </div>
      </div>
      {groupChats.map((chat) => (
        <div
          key={chat.id}
          className="friend-item group-item"
          onClick={() => onOpenGroupChat(chat)}
        >
          <span>{chat.name}</span>
        </div>
      ))}
      {groupChats.length === 0 && <p>Нет комнат</p>}
    </div>
  );
}
