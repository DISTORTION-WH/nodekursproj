import React, { useState } from "react";
import api from "../services/api";
import { useChat } from "../context/ChatContext";
import { BackArrowIcon } from "./icons";
import "../pages/HomePage.css";

export default function ChatHeader({ isMobile, onCloseChat }) {
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  const {
    activeChat,
    currentUser,
    openInviteModal,
    openMembersModal,
    handleKick,
    deleteMessages,
  } = useChat();

  const handleLeave = () => {
    handleKick(currentUser.id);
  };

  const handleDelete = (isAll) => {
    deleteMessages(isAll);
    setShowDeleteOptions(false);
  };

  return (
    <div className="chat-header">
      {isMobile && (
        <button className="chat-back-btn" onClick={onCloseChat}>
          <BackArrowIcon />
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
        {!activeChat.is_group && (
          <img
            src={
              activeChat.avatar_url
                ? api.defaults.baseURL + activeChat.avatar_url
                : "/default-avatar.png"
            }
            alt="avatar"
            className="chat-avatar"
          />
        )}
        <h2 className="chat-title">{activeChat.username || activeChat.name}</h2>
      </div>

      <div className="chat-actions">
        {activeChat.is_group ? (
          <>
            <button
              onClick={openInviteModal}
              className="chat-action-btn invite"
            >
              Пригласить
            </button>
            <button
              onClick={openMembersModal}
              className="chat-action-btn members"
            >
              Участники
            </button>
            <button onClick={handleLeave} className="chat-action-btn leave">
              Выйти
            </button>
          </>
        ) : !showDeleteOptions ? (
          <button
            onClick={() => setShowDeleteOptions(true)}
            className="chat-action-btn leave"
          >
            Очистить
          </button>
        ) : (
          <div className="delete-options">
            <button
              onClick={() => handleDelete(false)}
              className="chat-action-btn members"
            >
              У себя
            </button>
            <button
              onClick={() => handleDelete(true)}
              className="chat-action-btn leave"
            >
              У всех
            </button>
            <button
              onClick={() => setShowDeleteOptions(false)}
              className="chat-action-btn"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
