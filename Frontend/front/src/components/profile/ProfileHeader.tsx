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
      if (typeof handleAvatarChange === "function") {
        await handleAvatarChange(newAvatar);
        setUploadMessage("Аватар обновлён");
        setNewAvatar(null);
      }
    } catch (err: any) {
      setUploadMessage(err.response?.data?.message || "Ошибка при загрузке аватара");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-[30px] p-5 px-10 bg-[#202225] shrink-0 md:flex-col md:items-start md:p-5">
      <img
        className="w-40 h-40 rounded-full object-cover border-[3px] border-black/40 shadow-lg transition-transform hover:scale-105 md:w-[100px] md:h-[100px]"
        src={getImageUrl(currentUser?.avatar_url)}
        alt="avatar"
      />
      <div className="flex flex-col gap-0 text-sm max-w-[300px]">
        <p className="mb-1 text-white text-base">
          <strong className="text-[#b9bbbe]">Имя: </strong>
          {currentUser?.username || "—"}
        </p>
        <p className="mb-1 text-white text-base">
          <strong className="text-[#b9bbbe]">Роль: </strong>
          {currentUser?.role || "USER"}
        </p>
        <p className="mb-4 text-white text-base">
          <strong className="text-[#b9bbbe]">Зарегистрирован: </strong>
          {currentUser?.created_at
            ? new Date(currentUser.created_at).toLocaleDateString()
            : "—"}
        </p>

        <div className="flex flex-col gap-2 mt-2.5">
          <input
            type="file"
            accept="image/*"
            className="text-sm text-[#b9bbbe] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#2f3136] file:text-accent hover:file:bg-[#36393f]"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                  setNewAvatar(e.target.files[0]);
              }
              setUploadMessage("");
            }}
          />
          <div className="flex flex-col gap-2">
            <button 
              className="bg-accent text-white border-none py-2 px-3.5 rounded-lg cursor-pointer font-semibold transition-colors hover:bg-accent-hover md:w-full" 
              onClick={handleUploadClick}
            >
              Сменить аватар
            </button>
            {uploadMessage && (
              <div className="text-success text-sm font-semibold">{uploadMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}