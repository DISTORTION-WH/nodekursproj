import React, { useState, useEffect } from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useChat } from "../context/ChatContext";

export default function FriendChatList({ onOpenProfile }) {
  const [friends, setFriends] = useState([]);
  const { socket } = useSocket();
  const { selectChat } = useChat();

  const fetchFriends = () => {
    api
      .get("/friends")
      .then((res) => setFriends(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    if (socket) {
      const onFriendRequestAccepted = () => fetchFriends();
      const onFriendRemoved = () => fetchFriends();

      socket.on("friend_request_accepted", onFriendRequestAccepted);
      socket.on("friend_removed", onFriendRemoved);

      return () => {
        socket.off("friend_request_accepted", onFriendRequestAccepted);
        socket.off("friend_removed", onFriendRemoved);
      };
    }
  }, [socket]);

  const openChat = async (friend) => {
    try {
      const res = await api.post("/chats/private", { friendId: friend.id });
      selectChat({
        id: res.data.id,
        username: friend.username,
        avatar_url: friend.avatar_url,
        is_group: false,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="friends-section">
      <div className="section-header">
        <h2>Друзья</h2>
      </div>
      {friends.map((f) => (
        <div key={f.id} className="friend-item" onClick={() => openChat(f)}>
          <img
            src={
              f.avatar_url
                ? api.defaults.baseURL + f.avatar_url
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
              openChat(f);
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
