import React, { useState } from "react";
import api from "../services/api";

export default function UserSearch({ onOpenProfile }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = () => {
    if (!search.trim()) return;
    api
      .get(`/users?search=${encodeURIComponent(search)}`)
      .then((res) => setResults(res.data))
      .catch(console.error);
  };

  const addFriend = (id) => {
    api
      .post("/friends/request", { friendId: id })
      .then((res) => {
        alert(res.data.message);
        setSearch("");
        setResults([]);
      })
      .catch(console.error);
  };

  return (
    <div className="search-section">
      <h3>Поиск</h3>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Имя пользователя"
      />
      <button onClick={handleSearch}>Найти</button>
      {results.map((u) => (
        <div key={u.id} className="search-item">
          <img
            src={
              u.avatar_url
                ? api.defaults.baseURL + u.avatar_url
                : "/default-avatar.png"
            }
            alt="ava"
            className="avatar"
            onClick={() => onOpenProfile(u.id)}
          />
          <span>{u.username}</span>
          <button onClick={() => addFriend(u.id)}>Добавить</button>
        </div>
      ))}
    </div>
  );
}
