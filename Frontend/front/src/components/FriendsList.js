// src/components/FriendsList.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./FriendsList.css";
import { useSocket } from "../context/SocketContext";
import { useChat } from "../context/ChatContext";

// Импортируем новые компоненты
import GroupChatList from "./GroupChatList";
import FriendChatList from "./FriendChatList";
import IncomingRequests from "./IncomingRequests";
import UserSearch from "./UserSearch";

export default function FriendsList({ currentUser }) {
  const [friends, setFriends] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: "Bearer " + token } };

  const { socket } = useSocket();
  const { selectChat } = useChat();

  const fetchData = () => {
    if (!token) return;
    axios
      .get("/friends", config)
      .then((res) => setFriends(res.data))
      .catch(console.error);
    axios
      .get("/friends/incoming", config)
      .then((res) => setIncomingRequests(res.data))
      .catch(console.error);
    axios
      .get("/chats", config)
      .then((res) => setGroupChats(res.data.filter((chat) => chat.is_group)))
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (socket) {
      const onNewFriendRequest = () => {
        axios
          .get("/friends/incoming", config)
          .then((res) => setIncomingRequests(res.data));
      };

      const onFriendRequestAccepted = () => {
        axios.get("/friends", config).then((res) => setFriends(res.data));
      };

      const onFriendRemoved = () => {
        axios.get("/friends", config).then((res) => setFriends(res.data));
      };

      const onAddedToChat = () => {
        axios
          .get("/chats", config)
          .then((res) => setGroupChats(res.data.filter((c) => c.is_group)));
      };

      const onRemovedFromChat = (data) => {
        setGroupChats((prev) =>
          prev.filter((c) => Number(c.id) !== Number(data.chatId))
        );
      };

      socket.on("new_friend_request", onNewFriendRequest);
      socket.on("friend_request_accepted", onFriendRequestAccepted);
      socket.on("friend_removed", onFriendRemoved);
      socket.on("added_to_chat", onAddedToChat);
      socket.on("removed_from_chat", onRemovedFromChat);

      return () => {
        socket.off("new_friend_request", onNewFriendRequest);
        socket.off("friend_request_accepted", onFriendRequestAccepted);
        socket.off("friend_removed", onFriendRemoved);
        socket.off("added_to_chat", onAddedToChat);
        socket.off("removed_from_chat", onRemovedFromChat);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, token]);

  const handleSearch = () => {
    if (!search.trim()) return;
    axios
      .get(`/users?search=${encodeURIComponent(search)}`, config)
      .then((res) => setSearchResults(res.data))
      .catch(console.error);
  };

  const sendFriendRequest = (id) => {
    axios
      .post("/friends/request", { friendId: id }, config)
      .then((res) => {
        alert(res.data.message);
        setSearch("");
        setSearchResults([]);
      })
      .catch(console.error);
  };

  const acceptRequest = (id) => {
    axios
      .post("/friends/accept", { friendId: id }, config)
      .then(() => {
        setIncomingRequests((prev) =>
          prev.filter((req) => req.requester_id !== id)
        );
        fetchData();
      })
      .catch(console.error);
  };

  const openChat = async (friend) => {
    try {
      const res = await axios.post(
        "/chats/private",
        { friendId: friend.id },
        config
      );
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

  const openGroupChat = (chat) =>
    selectChat({
      id: chat.id,
      name: chat.name,
      is_group: true,
      creator_id: chat.creator_id,
    });

  const joinByCode = async () => {
    const code = prompt("Код приглашения:");
    if (!code?.trim()) return;
    try {
      const res = await axios.post("/chats/join", { inviteCode: code }, config);
      alert(`Вы вошли в: ${res.data.name}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Ошибка");
    }
  };

  const createGroupChat = async () => {
    const name = prompt("Название комнаты:");
    if (!name?.trim()) return;
    try {
      const res = await axios.post("/chats/group", { name }, config);
      setGroupChats((prev) => [...prev, res.data]);
      openGroupChat(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openProfile = (id) => navigate(`/profile/${id}`);

  // Теперь JSX стал чистым и декларативным
  return (
    <div className="friends-list">
      <GroupChatList
        groupChats={groupChats}
        onJoinByCode={joinByCode}
        onCreateGroup={createGroupChat}
        onOpenGroupChat={openGroupChat}
      />

      <FriendChatList
        friends={friends}
        onOpenChat={openChat}
        onOpenProfile={openProfile}
      />

      <div className="bottom-sections">
        <IncomingRequests
          requests={incomingRequests}
          onAccept={acceptRequest}
          onOpenProfile={openProfile}
        />

        <UserSearch
          search={search}
          onSearchChange={(e) => setSearch(e.target.value)}
          onSearchSubmit={handleSearch}
          results={searchResults}
          onAddFriend={sendFriendRequest}
          onOpenProfile={openProfile}
        />
      </div>
    </div>
  );
}
