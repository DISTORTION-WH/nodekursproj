// src/components/GroupChatList.js
import React from "react";

export default function GroupChatList({
  groupChats,
  onJoinByCode,
  onCreateGroup,
  onOpenGroupChat,
}) {
  return (
    <div className="friends-section">
      <div className="section-header">
        <h2>Комнаты</h2>
        <div className="section-header-actions">
          <button onClick={onJoinByCode} className="group-action-btn">
            Join
          </button>
          <button onClick={onCreateGroup} className="group-action-btn create">
            +
          </button>
        </div>
      </div>
      {groupChats.map((chat) => (
        <div
          key={chat.id}
          className="friend-item group-item"
          onClick={() => onOpenGroupChat(chat)}
        >
          <span>{chat.name}</span>
        </div>
      ))}
      {groupChats.length === 0 && <p>Нет комнат</p>}
    </div>
  );
}
