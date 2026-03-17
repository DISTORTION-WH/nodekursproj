import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useChat } from "../context/ChatContext";
import { Chat } from "../types";

interface GroupChatListProps {
  onOpenGroupChat: (chat: Chat) => void;
}

export default function GroupChatList({ onOpenGroupChat }: GroupChatListProps) {
  const [groupChats, setGroupChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { socket } = useSocket() as { socket: Socket | null };
  const { unreadCounts, activeChat } = useChat();

  const fetchGroupChats = () => {
    setError(false);
    api
      .get<Chat[]>("/chats")
      .then((res) => { setGroupChats(res.data.filter((c) => c.is_group)); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGroupChats();
  }, []);

  useEffect(() => {
    if (socket) {
      const onAdded = () => fetchGroupChats();
      const onRemoved = (data: { chatId: number }) =>
        setGroupChats((prev) => prev.filter((c) => Number(c.id) !== Number(data.chatId)));

      socket.on("added_to_chat", onAdded);
      socket.on("removed_from_chat", onRemoved);
      return () => {
        socket.off("added_to_chat", onAdded);
        socket.off("removed_from_chat", onRemoved);
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

  return (
    <div className="px-2 mb-2">
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-discord-text-muted text-xs uppercase font-semibold tracking-wide">
          Комнаты
        </span>
        <div className="flex-1 h-px mx-2" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="flex gap-1">
          <button
            onClick={joinByCode}
            className="text-discord-text-muted hover:text-white text-xs px-2 py-0.5 rounded hover:bg-discord-input transition"
            title="Войти по коду"
          >
            Join
          </button>
          <button
            onClick={createGroupChat}
            className="text-discord-text-muted hover:text-white text-sm px-2 py-0.5 rounded hover:bg-discord-input transition font-bold"
            title="Создать комнату"
          >
            +
          </button>
        </div>
      </div>

      {groupChats.map((chat) => {
        const unread = unreadCounts[Number(chat.id)] || 0;
        const isActive = activeChat?.id === chat.id;
        return (
          <div
            key={chat.id}
            className="flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition text-discord-text-secondary hover:text-white"
            style={
              isActive
                ? { background: "rgba(88,101,242,0.15)", borderLeft: "2px solid #5865f2", paddingLeft: "6px" }
                : {}
            }
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "";
            }}
            onClick={() => onOpenGroupChat(chat)}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #5865f2, #eb459e)" }}
            >
              {chat.name ? chat.name[0].toUpperCase() : "#"}
            </div>
            <span className="truncate text-sm flex-1">{chat.name}</span>
            {unread > 0 && (
              <span
                className="text-white text-xs rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center font-bold leading-none shrink-0"
                style={{ background: "linear-gradient(135deg, #eb3b5a, #fa7070)" }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        );
      })}

      {loading && (
        <div className="px-2 py-2 flex gap-2 flex-col">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-discord-input shrink-0" />
              <div className="h-3 bg-discord-input rounded w-20" />
            </div>
          ))}
        </div>
      )}
      {!loading && error && (
        <p className="text-discord-danger text-xs px-2 py-1 cursor-pointer hover:underline" onClick={fetchGroupChats}>
          Ошибка загрузки · Нажмите, чтобы повторить
        </p>
      )}
      {!loading && !error && groupChats.length === 0 && (
        <p className="text-discord-text-muted text-xs px-2 py-1">Нет комнат</p>
      )}
    </div>
  );
}
