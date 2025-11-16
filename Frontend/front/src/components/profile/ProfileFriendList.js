import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../../pages/ProfilePage.css";

export default function ProfileFriendList() {
  const [friends, setFriends] = useState([]);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};

  useEffect(() => {
    if (!token) return;
    axios
      .get("/friends", { headers: authHeaders })
      .then((res) => setFriends(res.data || []))
      .catch(() => setFriends([]));
    // eslint-disable-next-line
  }, [token]);

  const openFriendProfile = (id) => {
    navigate(`/profile/${id}`);
  };

  return (
    <section className="profile-friends-section">
      <h3 className="friends-title">Друзья</h3>
      <ul className="profile-friends-list">
        {friends && friends.length ? (
          friends.map((f) => (
            <li
              key={f.id}
              className="profile-friend-card"
              onClick={() => openFriendProfile(f.id)}
              style={{ cursor: "pointer" }}
            >
              <img
                src={
                  f.avatar_url
                    ? axios.defaults.baseURL + f.avatar_url
                    : "/default-avatar.png"
                }
                alt={f.username}
                className="profile-friend-avatar"
              />
              <div className="profile-friend-info">{f.username}</div>
            </li>
          ))
        ) : (
          <div key="no-friends" className="profile-no-friends">
            Нет друзей
          </div>
        )}
      </ul>
    </section>
  );
}
