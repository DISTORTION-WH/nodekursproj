// src/components/FriendChatList.js
import React from "react";
import axios from "axios";

export default function FriendChatList({ friends, onOpenChat, onOpenProfile }) {
  return (
    <div className="friends-section">
      <div className="section-header">
        <h2>Друзья</h2>
      </div>
      {friends.map((f) => (
        <div key={f.id} className="friend-item" onClick={() => onOpenChat(f)}>
          <img
            src={
              f.avatar_url
                ? axios.defaults.baseURL + f.avatar_url
                : "/default-avatar.png"
            }
            alt="ava"
            className="avatar"
            onClick={(e) => {
              e.stopPropagation();
              onOpenProfile(f.id);
            }}
          />
          <span>{f.username}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenChat(f);
            }}
          >
            Чат
          </button>
        </div>
      ))}
      {friends.length === 0 && <p>Нет друзей</p>}
    </div>
  );
}
