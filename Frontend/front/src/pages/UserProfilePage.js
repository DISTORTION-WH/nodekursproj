import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./UserProfilePage.css";

export default function UserProfilePage() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: "Bearer " + token } };

  useEffect(() => {
    if (!userId) return;

    //   axios.get(`http://localhost:5000/users/${userId}`, config)
    axios
      .get(`/users/${userId}`, config)
      .then((res) => {
        setUser(res.data);
        setFriends(res.data.friends || []);
      })
      .catch((err) => {
        console.error(err);
        alert("Ошибка при загрузке профиля пользователя");
        navigate(-1);
      });
  }, [userId]);

  const startChat = async () => {
    try {
      const friendId = user.id || user._id;
      if (!friendId) {
        alert("Ошибка: ID друга не найден");
        return;
      }

      const res = await axios.post(
        //     "http://localhost:5000/chats/private",
        "/chats/private",
        { friendId },
        config
      );

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
    } catch (err) {
      console.error("Ошибка создания чата:", err.response?.data || err.message);
      const serverMessage =
        err.response?.data?.message || err.response?.data || err.message;
      alert("Ошибка при создании чата: " + serverMessage);
    }
  };

  const removeFriend = async () => {
    if (!window.confirm("Удалить из друзей?")) return;
    try {
      await axios.post(
        //     `http://localhost:5000/friends/remove`,
        `/friends/remove`,
        { friendId: user.id },
        config
      );
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
          src={
            user.avatar_url
              ? axios.defaults.baseURL + user.avatar_url
              : "/default-avatar.png"
          }
          alt="avatar"
          className="user-profile-avatar"
        />
        <div className="user-profile-info">
          <h2>{user.username}</h2>
          <p>Роль: {user.role || "USER"}</p>
          <p>
            Зарегистрирован: {new Date(user.created_at).toLocaleDateString()}
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
                  src={
                    friend.avatar_url
                      ? axios.defaults.baseURL + friend.avatar_url
                      : "/default-avatar.png"
                  }
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
