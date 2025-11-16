import React, { useState } from "react";
import axios from "axios";
import "../../pages/ProfilePage.css";

export default function ProfileHeader({ currentUser, handleAvatarChange }) {
  const [newAvatar, setNewAvatar] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");

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

  return (
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
            <button className="profile-upload-btn" onClick={handleUploadClick}>
              Сменить аватар
            </button>
            {uploadMessage && (
              <div className="profile-upload-msg">{uploadMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
