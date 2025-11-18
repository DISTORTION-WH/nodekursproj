import React from "react";
import { useNavigate } from "react-router-dom";
import "./FriendsList.css";
import { useChat } from "../context/ChatContext";
import { User, Chat } from "../types";

import GroupChatList from "./GroupChatList";
import FriendChatList from "./FriendChatList";
import IncomingRequests from "./IncomingRequests";
import UserSearch from "./UserSearch";

interface FriendsListProps {
  currentUser: User | null;
}

export default function FriendsList({ currentUser }: FriendsListProps) {
  const navigate = useNavigate();
  // Исправлено: selectChat -> enterChat
  const { enterChat } = useChat();

  const openProfile = (id: number) => navigate(`/profile/${id}`);

  const openGroupChat = (chat: Chat) => {
    // Исправлено: передаем только ID
    enterChat(chat.id);
  };

  return (
    <div className="friends-list">
      <GroupChatList onOpenGroupChat={openGroupChat} />

      <FriendChatList />

      <div className="bottom-sections">
        <IncomingRequests onOpenProfile={openProfile} />

        <UserSearch onOpenProfile={openProfile} />
      </div>
    </div>
  );
}