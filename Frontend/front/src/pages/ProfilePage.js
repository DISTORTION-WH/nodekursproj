import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./ProfilePage.css";

export default function ProfilePage({
  currentUser,
  handleAvatarChange,
  setIsAuth,
  setRole,
}) {
  const [newAvatar, setNewAvatar] = useState(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [friends, setFriends] = useState([]);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};

  useEffect(() => {
    if (!token) return;
    axios
      //    .get("http://localhost:5000/friends", { headers: authHeaders })
      .get("/friends", { headers: authHeaders })
      .then((res) => setFriends(res.data || []))
      .catch(() => setFriends([]));
  }, []);

  const handleUploadClick = async () => {
    if (!newAvatar) {
      setUploadMessage("Выберите файл перед загрузкой");
      return;
    }
    setUploadMessage("");
    try {
      if (typeof handleAvatarChange === "function") {
        await handleAvatarChange(newAvatar);
        setUploadMessage("Аватар обновлён");
        setNewAvatar(null);
      }
    } catch (err) {
      setUploadMessage(
        err.response?.data?.message || "Ошибка при загрузке аватара"
      );
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      setPasswordMessage("Заполните оба поля");
      return;
    }
    setPasswordMessage("");
    setLoadingPassword(true);
    try {
      await axios.put(
        //     "http://localhost:5000/users/password",
        "/users/password",
        { oldPassword, newPassword },
        { headers: authHeaders }
      );
      setPasswordMessage("Пароль успешно изменён");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordMessage(err.response?.data?.message || "Ошибка смены пароля");
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
    setRole(null);
    navigate("/login");
  };

  const openFriendProfile = (id) => {
    navigate(`/profile/${id}`);
  };

  const friendsEls =
    friends && friends.length
      ? friends.map((f) => (
          <li
            key={f.id}
            className="profile-friend-card"
            onClick={() => openFriendProfile(f.id)}
            style={{ cursor: "pointer" }}
          >
            <img
              src={
                f.avatar_url
                  ? axios.defaults.baseURL + f.avatar_url
                  : "/default-avatar.png"
              }
              alt={f.username}
              className="profile-friend-avatar"
            />
            <div className="profile-friend-info">{f.username}</div>
          </li>
        ))
      : [
          <div key="no-friends" className="profile-no-friends">
            Нет друзей
          </div>,
        ];

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2 className="profile-title">Мой профиль</h2>

        <div className="profile-header">
          <img
            className="profile-avatar"
            src={
              currentUser && currentUser.avatar_url
                ? axios.defaults.baseURL +
                  currentUser.avatar_url +
                  "?t=" +
                  new Date().getTime()
                : "/default-avatar.png"
            }
            alt="avatar"
          />
          <div className="profile-info">
            <p>
              <strong>Имя: </strong>
              {currentUser?.username || "—"}
            </p>
            <p>
              <strong>Роль: </strong>
              {currentUser?.role || "USER"}
            </p>
            <p>
              <strong>Зарегистрирован: </strong>
              {currentUser?.created_at
                ? new Date(currentUser.created_at).toLocaleString()
                : "—"}
            </p>

            <div className="profile-upload">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  setNewAvatar(e.target.files && e.target.files[0]);
                  setUploadMessage("");
                }}
              />
              <div className="upload-actions">
                <button
                  className="profile-upload-btn"
                  onClick={handleUploadClick}
                >
                  Сменить аватар
                </button>
                {uploadMessage && (
                  <div className="profile-upload-msg">{uploadMessage}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="profile-friends-section">
          <h3 className="friends-title">Друзья</h3>
          <ul className="profile-friends-list">{friendsEls}</ul>
        </section>

        <section className="profile-password-section">
          <h3 className="password-title">Смена пароля</h3>
          <input
            className="password-input"
            type="password"
            placeholder="Старый пароль"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <input
            className="password-input"
            type="password"
            placeholder="Новый пароль"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="password-buttons-wrapper">
            <button
              className="password-btn"
              onClick={handleChangePassword}
              disabled={loadingPassword}
            >
              {loadingPassword ? "Смена..." : "Сменить пароль"}
            </button>
            <button className="profile-logout-btn" onClick={handleLogout}>
              Выйти
            </button>
            {passwordMessage && (
              <div className="password-message">{passwordMessage}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
