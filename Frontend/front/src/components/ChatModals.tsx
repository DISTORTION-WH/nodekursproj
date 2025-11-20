import React from "react";
import { useChat } from "../context/ChatContext";

export default function ChatModals() {
  const {
    modalView,
    closeModal,
    friendsForInvite,
    chatMembers,
    activeChat,
    currentUser,
    handleInvite,
    handleKick,
    handleGetInviteCode,
  } = useChat();

  if (!modalView || !activeChat || !currentUser) return null;

  const isInvite = modalView === "invite";
  const list: any[] = isInvite ? friendsForInvite : chatMembers;

  const modalBtnBase = "border-none py-1.5 px-3 rounded text-sm cursor-pointer text-white font-medium transition-opacity hover:opacity-90";

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[1000]" onClick={closeModal}>
      <div 
        className="bg-[#36393f] rounded-lg w-[400px] max-w-[90%] flex flex-col max-h-[80vh] shadow-2xl animate-fadeIn" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#202225] flex justify-between items-center shrink-0">
          <h3 className="m-0 text-white text-lg font-bold">
            {isInvite ? "Пригласить" : "Участники"}
          </h3>
          <button className="bg-transparent border-none text-[#b9bbbe] text-2xl cursor-pointer hover:text-white" onClick={closeModal}>
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {list.length === 0 && (
            <p className="text-center text-[#b9bbbe] my-2.5">
              {isInvite ? "Все друзья уже в чате" : "Нет участников"}
            </p>
          )}
          {list.map((item) => (
            <div key={item.id} className="flex justify-between items-center p-2 border-b border-[#2f3136] last:border-none hover:bg-[#2f3136] rounded">
              <span className="text-white font-medium">
                {item.username}{" "}
                {item.id === activeChat.creator_id && !isInvite ? "👑" : ""}
              </span>
              {isInvite ? (
                <button
                  className={`${modalBtnBase} bg-accent`}
                  onClick={() => handleInvite(item.id)}
                >
                  Пригласить
                </button>
              ) : (
                ((currentUser.id === activeChat.creator_id &&
                  item.id !== currentUser.id) ||
                  item.invited_by_user_id === currentUser.id) && (
                  <button
                    className={`${modalBtnBase} bg-danger`}
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
          <div className="p-4 border-t border-[#202225] text-right bg-[#2f3136] rounded-b-lg">
            <button className={`${modalBtnBase} bg-accent w-full`} onClick={handleGetInviteCode}>
              Код приглашения
            </button>
          </div>
        )}
      </div>
    </div>
  );
}