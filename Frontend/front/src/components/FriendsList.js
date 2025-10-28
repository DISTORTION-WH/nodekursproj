import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./FriendsList.css";

export default function FriendsList({ setActiveChat }) {
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: "Bearer " + token } };

  useEffect(() => {
    axios.get("http://localhost:5000/friends", config)
      .then(res => setFriends(res.data))
      .catch(console.error);

    axios.get("http://localhost:5000/friends/incoming", config)
      .then(res => setIncomingRequests(res.data))
      .catch(console.error);
  }, []);

  const handleSearch = () => {
    if (!search.trim()) return;
    axios.get(`http://localhost:5000/users?search=${encodeURIComponent(search)}`, config)
      .then(res => setSearchResults(res.data))
      .catch(console.error);
  };

  const sendFriendRequest = (friendId) => {
    axios.post("http://localhost:5000/friends/request", { friendId }, config)
      .then(res => {
        alert(res.data.message);
        setSearch("");
        setSearchResults([]);
      })
      .catch(console.error);
  };

  const acceptRequest = (friendId) => {
    axios.post("http://localhost:5000/friends/accept", { friendId }, config)
      .then(res => {
        alert(res.data.message);
        window.location.reload();
      })
      .catch(console.error);
  };

  const openChat = async (friend) => {
    try {
      const res = await axios.post(
        "http://localhost:5000/chats/private",
        { friendId: friend.id },
        config
      );
      setActiveChat({
        id: res.data.id,
        username: friend.username,
        avatar_url: friend.avatar_url
      });
    } catch (err) {
      console.error(err);
    }
  };

  const openProfile = (friend) => {
    navigate(`/profile/${friend.id}`);
  };

  const friendsEls = friends.map(friend =>
    <div
      key={friend.id}
      className="friend-item"
      onClick={() => openChat(friend)} // ✅ теперь клик по всей строке открывает чат
      style={{ cursor: "pointer" }}
    >
      <img
        src={friend.avatar_url ? "http://localhost:5000" + friend.avatar_url : "/default-avatar.png"}
        alt="avatar"
        className="avatar"
        onClick={(e) => {
          e.stopPropagation(); // 🔑 чтобы при клике на аватар не открывался чат
          openProfile(friend);
        }}
      />
      <span>{friend.username}</span>

      {/* Кнопка "Чат" остаётся, но не мешает клику по строке */}
      <button
        onClick={(e) => {
          e.stopPropagation(); // 🔑 предотвращаем дублирование
          openChat(friend);
        }}
      >
        Чат
      </button>
    </div>
  );

  const incomingEls = incomingRequests.length === 0
    ? [<p key="no-req">Нет новых запросов</p>]
    : incomingRequests.map(req =>
      <div key={req.requester_id} className="incoming-item">
        <img
          src={req.requester_avatar ? "http://localhost:5000" + req.requester_avatar : "/default-avatar.png"}
          alt="avatar"
          className="avatar"
          onClick={() => openProfile({ id: req.requester_id })}
        />
        <span>{req.requester_name}</span>
        <button onClick={() => acceptRequest(req.requester_id)}>Принять</button>
      </div>
    );

  const searchEls = searchResults.map(user =>
    <div key={user.id} className="search-item">
      <img
        src={user.avatar_url ? "http://localhost:5000" + user.avatar_url : "/default-avatar.png"}
        alt="avatar"
        className="avatar"
        onClick={() => openProfile(user)}
      />
      <span>{user.username}</span>
      <button onClick={() => sendFriendRequest(user.id)}>Добавить</button>
    </div>
  );

  return (
    <div className="friends-list">
      <div className="friends-section">
        <h2>Друзья</h2>
        {friendsEls}
      </div>

      <div className="bottom-sections">
        <div className="incoming-section">
          <h3>Входящие запросы</h3>
          {incomingEls}
        </div>

        <div className="search-section">
          <h3>Найти новых друзей</h3>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск пользователя"
          />
          <button onClick={handleSearch}>Найти</button>
          {searchEls}
        </div>
      </div>
    </div>
  );
}
