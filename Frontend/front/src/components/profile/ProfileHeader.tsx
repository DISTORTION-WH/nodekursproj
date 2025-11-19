import React, { useState } from "react";
import "../../pages/ProfilePage.css";
import { User } from "../../types";
import { getImageUrl } from "../../utils/imageUrl";

interface ProfileHeaderProps {
  currentUser: User | null;
  handleAvatarChange: (file: File) => Promise<void>;
}

export default function ProfileHeader({ currentUser, handleAvatarChange }: ProfileHeaderProps) {
  const [newAvatar, setNewAvatar] = useState<File | null>(null);
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
    } catch (err: any) {
      setUploadMessage(
        err.response?.data?.message || "Ошибка при загрузке аватара"
      );
    }
  };

  return (
    <div className="profile-header">
      <img
        className="profile-avatar"
        src={getImageUrl(currentUser?.avatar_url)}
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
              if (e.target.files && e.target.files[0]) {
                  setNewAvatar(e.target.files[0]);
              }
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