import React from "react";
import { useChat } from "../context/ChatContext";
import "../pages/HomePage.css";

export default function ChatModals() {
  const {
    modalView,
    closeModal,
    friendsForInvite,
    chatMembers,
    currentChat, // Исправлено: activeChat -> currentChat
    currentUser,
    handleInvite,
    handleKick,
    handleGetInviteCode,
  } = useChat();

  if (!modalView || !currentChat || !currentUser) return null;

  const isInvite = modalView === "invite";

  const list: any[] = isInvite ? friendsForInvite : chatMembers;

  // Приведение к any для доступа к полям, если типы расходятся
  const chatAny = currentChat as any; 

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {isInvite ? "Пригласить" : "Участники"}
          </h3>
          <button className="modal-close-btn" onClick={closeModal}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {list.length === 0 && (
            <p style={{ textAlign: "center", color: "#8e9297" }}>
              {isInvite ? "Все друзья уже в чате" : "Нет участников"}
            </p>
          )}
          {list.map((item) => (
            <div key={item.id} className="modal-item">
              <span>
                {item.username}{" "}
                {item.id === chatAny.creator_id && !isInvite ? "👑" : ""}
              </span>
              {isInvite ? (
                <button
                  className="modal-btn invite"
                  onClick={() => handleInvite(item.id)}
                >
                  Пригласить
                </button>
              ) : (
                ((currentUser.id === chatAny.creator_id &&
                  item.id !== currentUser.id) ||
                  item.invited_by_user_id === currentUser.id) && (
                  <button
                    className="modal-btn kick"
                    onClick={() => handleKick(item.id)}
                  >
                    Удалить
                  </button>
                )
              )}
            </div>
          ))}
        </div>
        {!isInvite && (
          <div className="modal-footer">
            <button className="modal-btn invite" onClick={handleGetInviteCode}>
              Код приглашения
            </button>
          </div>
        )}
      </div>
    </div>
  );
}