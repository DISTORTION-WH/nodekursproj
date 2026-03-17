import React, { useState } from "react";
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
      await handleAvatarChange(newAvatar);
      setUploadMessage("Аватар обновлён");
      setNewAvatar(null);
    } catch (err: any) {
      setUploadMessage(err.response?.data?.message || "Ошибка при загрузке аватара");
    }
  };

  return (
    <div className="bg-discord-secondary rounded-xl p-6 flex items-start gap-6 flex-wrap">
      <img
        className="w-32 h-32 rounded-full object-cover ring-4 ring-discord-accent shrink-0"
        src={getImageUrl(currentUser?.avatar_url)}
        alt="avatar"
      />
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-discord-text-secondary">
            <span className="text-discord-text-muted">Имя: </span>
            <span className="text-white font-medium">{currentUser?.username || "—"}</span>
          </p>
          <p className="text-discord-text-secondary">
            <span className="text-discord-text-muted">Роль: </span>
            <span className="text-discord-accent font-medium">{currentUser?.role || "USER"}</span>
          </p>
          <p className="text-discord-text-secondary">
            <span className="text-discord-text-muted">Email: </span>
            <span className="text-white">{currentUser?.email || "—"}</span>
          </p>
          <p className="text-discord-text-secondary">
            <span className="text-discord-text-muted">Зарегистрирован: </span>
            <span className="text-white">
              {currentUser?.created_at
                ? new Date(currentUser.created_at).toLocaleString()
                : "—"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-2">
          <input
            type="file"
            accept="image/*"
            className="text-xs text-discord-text-secondary file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-discord-input file:text-white hover:file:bg-discord-input-hover cursor-pointer"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) setNewAvatar(e.target.files[0]);
              setUploadMessage("");
            }}
          />
          <button
            onClick={handleUploadClick}
            className="bg-discord-accent hover:bg-discord-accent-hover text-white text-sm px-3 py-1 rounded transition"
          >
            Сменить аватар
          </button>
        </div>
        {uploadMessage && (
          <p className="text-discord-success text-xs mt-1">{uploadMessage}</p>
        )}
      </div>
    </div>
  );
}
