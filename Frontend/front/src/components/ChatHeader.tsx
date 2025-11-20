import React, { useState } from "react";
import { useChat } from "../context/ChatContext";
import { useCall } from "../context/CallContext";
import { BackArrowIcon, PhoneIcon, VideoIcon } from "./icons";
import { getImageUrl } from "../utils/imageUrl";

interface ChatHeaderProps {
  isMobile: boolean;
  onCloseChat: () => void;
}

export default function ChatHeader({ isMobile, onCloseChat }: ChatHeaderProps) {
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  const {
    activeChat,
    currentUser,
    openInviteModal,
    openMembersModal,
    handleKick,
    deleteMessages,
  } = useChat();

  const { startCall } = useCall();

  if (!activeChat || !currentUser) return null;

  const handleLeave = () => {
    handleKick(currentUser.id);
  };

  const handleDelete = (isAll: boolean) => {
    deleteMessages(isAll);
    setShowDeleteOptions(false);
  };

  const handleCall = (video: boolean) => {
    if (activeChat.is_group) {
        alert("Звонки в группах не поддерживаются");
        return;
    }
    const targetId = activeChat.participants?.find(p => Number(p.id) !== Number(currentUser.id))?.id;

    if (!targetId) {
       alert("Ошибка: Не удалось определить ID пользователя для звонка.");
       return;
    }
    startCall(Number(targetId), video);
  };

  const actionBtnClass = "bg-transparent border-none text-[#b9bbbe] cursor-pointer p-2 rounded transition-colors hover:text-white hover:bg-[#40444b]";
  const redBtnClass = "bg-transparent border-none text-danger cursor-pointer p-2 rounded transition-colors hover:text-white hover:bg-danger";

  return (
    <div className="h-[60px] border-b border-[#202225] flex justify-between items-center px-4 bg-[#36393f] shrink-0 shadow-sm">
      {isMobile && (
        <button className="mr-2.5 bg-transparent border-none text-white text-2xl cursor-pointer flex items-center p-1" onClick={onCloseChat}>
          <BackArrowIcon />
        </button>
      )}

      <div className="flex items-center min-w-0 flex-1 overflow-hidden">
        {!activeChat.is_group && (
          <img
            src={getImageUrl(activeChat.avatar_url)}
            alt="avatar"
            className="w-8 h-8 rounded-full mr-2.5 object-cover shrink-0"
          />
        )}
        <h2 className="font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis text-base m-0">
          {activeChat.username || activeChat.name}
        </h2>
      </div>

      <div className="flex items-center gap-1.5 ml-2.5">
        {!activeChat.is_group && (
            <>
                <button className={actionBtnClass} onClick={() => handleCall(false)} title="Аудиозвонок">
                    <PhoneIcon />
                </button>
                <button className={actionBtnClass} onClick={() => handleCall(true)} title="Видеозвонок">
                    <VideoIcon />
                </button>
            </>
        )}

        {activeChat.is_group ? (
          <>
            <button onClick={openInviteModal} className={actionBtnClass}>Пригласить</button>
            <button onClick={openMembersModal} className={actionBtnClass}>Участники</button>
            <button onClick={handleLeave} className={redBtnClass}>Выйти</button>
          </>
        ) : !showDeleteOptions ? (
          <button onClick={() => setShowDeleteOptions(true)} className={redBtnClass}>Очистить</button>
        ) : (
          <div className="flex items-center gap-2 bg-[#202225] p-1 rounded">
            <button onClick={() => handleDelete(false)} className={actionBtnClass}>У себя</button>
            <button onClick={() => handleDelete(true)} className={redBtnClass}>У всех</button>
            <button onClick={() => setShowDeleteOptions(false)} className={actionBtnClass}>Отмена</button>
          </div>
        )}
      </div>
    </div>
  );
}