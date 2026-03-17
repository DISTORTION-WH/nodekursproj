import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { User } from "../types";
import { getImageUrl } from "../utils/imageUrl";
import { useAuth } from "../context/AuthContext";

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!userId) return;

    api
      .get<User>(`/users/${userId}`)
      .then((res) => {
        setUser(res.data);
        setFriends(res.data.friends || []);
      })
      .catch((err) => {
        console.error(err);
        alert("Ошибка при загрузке профиля пользователя");
        navigate(-1);
      });
  }, [userId, navigate]);

  const startChat = async () => {
    if (!user) return;
    try {
      const res = await api.post<{ id: number }>("/chats/private", { friendId: user.id });
      if (!res.data?.id) {
        alert("Ошибка: сервер не вернул ID чата");
        return;
      }
      navigate("/", {
        state: {
          openChatId: res.data.id,
          friend: { username: user.username, avatar_url: user.avatar_url },
        },
      });
    } catch (err: any) {
      alert("Ошибка при создании чата: " + (err.response?.data?.message || err.message));
    }
  };

  const removeFriend = async () => {
    if (!user || !window.confirm("Удалить из друзей?")) return;
    try {
      await api.post(`/friends/remove`, { friendId: user.id });
      // Optimistic update - no page reload
      setFriends((prev) => prev.filter((f) => Number(f.id) !== Number(currentUser?.id)));
      setUser((prev) =>
        prev
          ? {
              ...prev,
              friends: (prev.friends || []).filter(
                (f) => Number(f.id) !== Number(currentUser?.id)
              ),
            }
          : prev
      );
      alert("Пользователь удалён из друзей");
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении из друзей");
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center text-discord-text-muted bg-discord-bg">
        Загрузка...
      </div>
    );
  }

  const isMe = Number(currentUser?.id) === Number(user.id);
  const isFriend = currentUser?.friends?.some((f) => Number(f.id) === Number(user.id));

  return (
    <div className="flex-1 overflow-y-auto bg-discord-bg p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <h2 className="text-white text-2xl font-bold">Профиль</h2>

        {/* Profile header */}
        <div className="bg-discord-secondary rounded-xl p-6 flex items-start gap-6 flex-wrap">
          <img
            src={getImageUrl(user.avatar_url)}
            alt="avatar"
            className="w-24 h-24 rounded-full object-cover ring-4 ring-discord-accent shrink-0"
          />
          <div className="flex flex-col gap-1 text-sm flex-1">
            <p className="text-white text-xl font-semibold">{user.username}</p>
            <p className="text-discord-text-muted">
              Роль:{" "}
              <span className="text-discord-accent font-medium">
                {user.role || "USER"}
              </span>
            </p>
            <p className="text-discord-text-muted">
              Зарегистрирован:{" "}
              <span className="text-discord-text-secondary">
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : "—"}
              </span>
            </p>
          </div>
        </div>

        {/* Friends */}
        <div className="bg-discord-secondary rounded-xl p-6">
          <h3 className="text-white font-semibold text-base mb-3">Друзья</h3>
          {friends.length === 0 ? (
            <p className="text-discord-text-muted text-sm">Нет друзей</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer hover:-translate-y-1 transition w-28 shrink-0"
                  onClick={() => navigate(`/profile/${friend.id}`)}
                >
                  <img
                    src={getImageUrl(friend.avatar_url)}
                    alt={friend.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <span className="text-discord-text-secondary text-xs text-center truncate w-full">
                    {friend.username}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isMe && (
          <div className="flex gap-3">
            <button
              onClick={startChat}
              className="bg-discord-accent hover:bg-discord-accent-hover text-white font-semibold px-4 py-2 rounded transition"
            >
              Начать чат
            </button>
            {isFriend && (
              <button
                onClick={removeFriend}
                className="bg-discord-danger/20 hover:bg-discord-danger text-discord-danger hover:text-white font-semibold px-4 py-2 rounded transition"
              >
                Удалить из друзей
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
