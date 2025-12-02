import React from "react";
import { useChat } from "../context/ChatContext";
import "../pages/HomePage.css";
import { kickUserFromGroup } from "../services/api";

export default function ChatModals() {
  const {
    modalView,
    closeModal,
    friendsForInvite,
    chatMembers,
    activeChat,
    currentUser,
    handleInvite,
    handleGetInviteCode,
    setChatMembers // Теперь это свойство существует в типе контекста
  } = useChat();

  if (!modalView || !activeChat || !currentUser) return null;

  const isInvite = modalView === "invite";
  const list: any[] = isInvite ? friendsForInvite : chatMembers;

  const isModerator = currentUser.roles?.includes('MODERATOR') || currentUser.role === 'ADMIN' || currentUser.roles?.includes('ADMIN');

  const onKick = async (userId: number) => {
      if(!window.confirm("Исключить пользователя?")) return;
      try {
          await kickUserFromGroup(activeChat.id, userId);
          // Типы prev и m теперь выводятся автоматически из контекста
          setChatMembers(prev => prev.filter(m => m.id !== userId));
      } catch(e) {
          console.error(e);
          alert("Не удалось исключить пользователя");
      }
  };

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
                {item.id === activeChat.creator_id && !isInvite ? "👑" : ""}
                {item.roles?.includes('MODERATOR') && <span style={{color:'gold', fontSize:'0.8em'}}> [MOD]</span>}
              </span>
              {isInvite ? (
                <button
                  className="modal-btn invite"
                  onClick={() => handleInvite(item.id)}
                >
                  Пригласить
                </button>
              ) : (
                ((currentUser.id === activeChat.creator_id && item.id !== currentUser.id) ||
                 (isModerator && item.id !== currentUser.id) ||
                 (item.invited_by_user_id === currentUser.id && item.id !== currentUser.id)) && (
                  <button
                    className="modal-btn kick"
                    onClick={() => onKick(item.id)}
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