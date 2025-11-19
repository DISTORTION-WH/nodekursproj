import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import "./UserProfilePage.css";
import { User } from "../types";
import { getImageUrl } from "../utils/imageUrl";

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const navigate = useNavigate();

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
      const friendId = user.id;
      if (!friendId) {
        alert("Ошибка: ID друга не найден");
        return;
      }

      const res = await api.post<{ id: number }>("/chats/private", { friendId });

      if (!res.data || !res.data.id) {
        alert("Ошибка: сервер не вернул ID чата");
        return;
      }

      navigate("/", {
        state: {
          openChatId: res.data.id,
          friend: {
            username: user.username,
            avatar_url: user.avatar_url,
          },
        },
      });
    } catch (err: any) {
      console.error("Ошибка создания чата:", err.response?.data || err.message);
      const serverMessage =
        err.response?.data?.message || err.response?.data || err.message;
      alert("Ошибка при создании чата: " + serverMessage);
    }
  };

  const removeFriend = async () => {
    if (!user || !window.confirm("Удалить из друзей?")) return;
    try {
      await api.post(`/friends/remove`, { friendId: user.id });
      alert("Пользователь удалён из друзей");
      navigate(-1);
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении из друзей");
    }
  };

  if (!user) {
    return <p className="user-profile-page-loading">Загрузка...</p>;
  }

  return (
    <div className="user-profile-page">
      <h1 className="user-profile-title">Профиль</h1>

      <div className="user-profile-header">
        <img
          src={getImageUrl(user.avatar_url)}
          alt="avatar"
          className="user-profile-avatar"
        />
        <div className="user-profile-info">
          <h2>{user.username}</h2>
          <p>Роль: {user.role || "USER"}</p>
          <p>
            Зарегистрирован: {user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
          </p>
        </div>
      </div>

      <div className="user-profile-friends-section">
        <h3 className="user-friends-title">Друзья</h3>
        {friends.length === 0 ? (
          <p className="user-no-friends">Нет друзей</p>
        ) : (
          <ul className="user-profile-friends-list">
            {friends.map((friend) => (
              <li
                key={friend.id}
                className="user-profile-friend-card"
                onClick={() => navigate(`/profile/${friend.id}`)}
              >
                <img
                  src={getImageUrl(friend.avatar_url)}
                  alt="friend-avatar"
                  className="user-profile-friend-avatar"
                />
                <span className="user-profile-friend-info">
                  {friend.username}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="user-profile-actions">
        <button onClick={startChat} className="user-profile-btn">
          Начать чат
        </button>
        <button onClick={removeFriend} className="user-profile-btn danger">
          Удалить из друзей
        </button>
      </div>
    </div>
  );
}