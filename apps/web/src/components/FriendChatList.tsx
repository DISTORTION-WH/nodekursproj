import { useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useChat } from "../context/ChatContext";
import { User, UserStatus } from "../types";
import { getImageUrl } from "../utils/imageUrl";

interface FriendChatListProps {
  onOpenProfile: (id: number) => void;
}

const statusColor: Record<UserStatus, string> = {
  online: "bg-discord-success",
  away: "bg-discord-warn",
  dnd: "bg-discord-danger",
  offline: "bg-discord-text-muted",
};

export default function FriendChatList({ onOpenProfile }: FriendChatListProps) {
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [friendChatIds, setFriendChatIds] = useState<Record<number, number>>({});
  const { socket, userStatuses } = useSocket() as { socket: Socket | null; userStatuses: Record<number, UserStatus> };
  const { selectChat, unreadCounts, activeChat } = useChat();

  const fetchFriends = () => {
    setError(false);
    api
      .get<User[]>("/friends")
      .then((res) => { setFriends(res.data); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("friend_request_accepted", fetchFriends);
      socket.on("friend_removed", fetchFriends);
      return () => {
        socket.off("friend_request_accepted", fetchFriends);
        socket.off("friend_removed", fetchFriends);
      };
    }
  }, [socket]);

  const openChat = async (friend: User) => {
    try {
      const res = await api.post<{ id: number }>("/chats/private", { friendId: friend.id });
      const chatId = res.data.id;
      setFriendChatIds((prev) => ({ ...prev, [friend.id]: chatId }));
      selectChat({
        id: chatId,
        username: friend.username,
        avatar_url: friend.avatar_url || undefined,
        is_group: false,
        name: null,
        participants: [{ id: friend.id, username: friend.username }] as any,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="px-2 mb-2">
      <div className="flex items-center px-2 py-2">
        <span className="text-discord-text-muted text-xs uppercase font-semibold tracking-wide flex-1">
          Друзья
        </span>
        <div className="flex-1 h-px ml-2" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>

      {friends.map((f, index) => {
        const chatId = friendChatIds[f.id];
        const unread = chatId ? (unreadCounts[chatId] || 0) : 0;
        const status: UserStatus = (userStatuses as Record<number, UserStatus>)[f.id] ?? (f.status ?? "offline");
        const isActive = chatId !== undefined && activeChat?.id === chatId;

        return (
          <div
            key={f.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition group animate-fade-in-up"
            style={{
              animationDelay: `${index * 40}ms`,
              ...(isActive
                ? { background: "rgba(88,101,242,0.15)", borderLeft: "2px solid #5865f2", paddingLeft: "6px" }
                : {}),
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "";
            }}
            onClick={() => openChat(f)}
          >
            {/* Avatar with status dot */}
            <div className="relative shrink-0">
              <img
                src={getImageUrl(f.avatar_url)}
                alt={f.username}
                className="w-8 h-8 rounded-full object-cover cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProfile(f.id);
                }}
              />
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-discord-secondary ${statusColor[status]}`}
              />
            </div>

            <span className="text-discord-text-secondary group-hover:text-discord-text-primary text-sm truncate flex-1">
              {f.username}
            </span>

            {/* Unread badge */}
            {unread > 0 && (
              <span
                className="text-white text-xs rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center font-bold leading-none shrink-0"
                style={{ background: "linear-gradient(135deg, #eb3b5a, #fa7070)" }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}

            <button
              className="opacity-0 group-hover:opacity-100 text-xs bg-discord-accent hover:bg-discord-accent-hover text-white px-2 py-0.5 rounded transition shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                openChat(f);
              }}
            >
              Чат
            </button>
          </div>
        );
      })}

      {loading && (
        <div className="px-2 py-2 flex gap-2 flex-col">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-discord-input shrink-0" />
              <div className="h-3 bg-discord-input rounded w-24" />
            </div>
          ))}
        </div>
      )}
      {!loading && error && (
        <p className="text-discord-danger text-xs px-2 py-1 cursor-pointer hover:underline" onClick={fetchFriends}>
          Ошибка загрузки · Нажмите, чтобы повторить
        </p>
      )}
      {!loading && !error && friends.length === 0 && (
        <p className="text-discord-text-muted text-xs px-2 py-1">Нет друзей</p>
      )}
    </div>
  );
}
