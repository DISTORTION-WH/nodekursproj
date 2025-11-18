import React, { useState } from "react";
import api from "../services/api";
import { useChat } from "../context/ChatContext";
import { useCall } from "../context/CallContext";
import { BackArrowIcon, PhoneIcon, VideoIcon } from "./icons";
import "../pages/HomePage.css";

interface ChatHeaderProps {
  isMobile: boolean;
  onCloseChat: () => void;
}

export default function ChatHeader({ isMobile, onCloseChat }: ChatHeaderProps) {
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  const {
    currentChat, // Исправлено: activeChat -> currentChat
    currentUser, // Теперь это доступно в ChatContext
    openInviteModal,
    openMembersModal,
    handleKick,
    deleteMessages,
  } = useChat();

  const { startCall } = useCall();

  // Используем currentChat вместо activeChat
  if (!currentChat || !currentUser) return null;

  // Приводим к any, чтобы обойти различия в camelCase/snake_case, если API возвращает по-разному
  const chatAny = currentChat as any;

  const handleLeave = () => {
    handleKick(currentUser.id);
  };

  const handleDelete = (isAll: boolean) => {
    deleteMessages(isAll);
    setShowDeleteOptions(false);
  };

  const handleCall = (video: boolean) => {
    if (currentChat.isGroup) { // В интерфейсе ChatContext это isGroup (camelCase)
        alert("Звонки в группах не поддерживаются");
        return;
    }

    let targetId: number | undefined;

    // Пытаемся найти собеседника в списке участников
    if (currentChat.participants && currentChat.participants.length > 0) {
        // Явная типизация p: any для устранения ошибки
        const friend = currentChat.participants.find((p: any) => Number(p.id) !== Number(currentUser.id));
        targetId = friend?.id;
    }

    if (!targetId) {
       alert("Ошибка: Не удалось определить ID собеседника. Попробуйте обновить страницу.");
       return;
    }

    startCall(Number(targetId), video);
  };

  // Определяем правильные поля для отображения (поддержка и camelCase и snake_case)
  const avatarUrl = chatAny.avatar_url || chatAny.avatarUrl;
  const chatName = chatAny.username || chatAny.name || currentChat.name;
  const isGroup = currentChat.isGroup || chatAny.is_group;

  return (
    <div className="chat-header">
      {isMobile && (
        <button className="chat-back-btn" onClick={onCloseChat}>
          <BackArrowIcon />
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
        {!isGroup && (
          <img
            src={
              avatarUrl
                ? api.defaults.baseURL + avatarUrl
                : "/default-avatar.png"
            }
            alt="avatar"
            className="chat-avatar"
          />
        )}
        <h2 className="chat-title">{chatName}</h2>
      </div>

      <div className="chat-actions">
        {!isGroup && (
            <>
                <button className="chat-action-btn" onClick={() => handleCall(false)} title="Аудиозвонок">
                    <PhoneIcon />
                </button>
                <button className="chat-action-btn" onClick={() => handleCall(true)} title="Видеозвонок">
                    <VideoIcon />
                </button>
            </>
        )}

        {isGroup ? (
          <>
            <button onClick={openInviteModal} className="chat-action-btn invite">
              Пригласить
            </button>
            <button onClick={openMembersModal} className="chat-action-btn members">
              Участники
            </button>
            <button onClick={handleLeave} className="chat-action-btn leave">
              Выйти
            </button>
          </>
        ) : !showDeleteOptions ? (
          <button onClick={() => setShowDeleteOptions(true)} className="chat-action-btn leave">
            Очистить
          </button>
        ) : (
          <div className="delete-options">
            <button onClick={() => handleDelete(false)} className="chat-action-btn members">
              У себя
            </button>
            <button onClick={() => handleDelete(true)} className="chat-action-btn leave">
              У всех
            </button>
            <button onClick={() => setShowDeleteOptions(false)} className="chat-action-btn">
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}