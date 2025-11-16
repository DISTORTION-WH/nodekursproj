// src/components/UserSearch.js
import React from "react";
import axios from "axios";

export default function UserSearch({
  search,
  onSearchChange,
  onSearchSubmit,
  results,
  onAddFriend,
  onOpenProfile,
}) {
  return (
    <div className="search-section">
      <h3>Поиск</h3>
      <input
        value={search}
        onChange={onSearchChange}
        placeholder="Имя пользователя"
      />
      <button onClick={onSearchSubmit}>Найти</button>
      {results.map((u) => (
        <div key={u.id} className="search-item">
          <img
            src={
              u.avatar_url
                ? axios.defaults.baseURL + u.avatar_url
                : "/default-avatar.png"
            }
            alt="ava"
            className="avatar"
            onClick={() => onOpenProfile(u.id)}
          />
          <span>{u.username}</span>
          <button onClick={() => onAddFriend(u.id)}>Добавить</button>
        </div>
      ))}
    </div>
  );
}
