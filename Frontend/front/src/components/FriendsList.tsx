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
  const { selectChat } = useChat();

  const openProfile = (id: number) => navigate(`/profile/${id}`);

  const openGroupChat = (chat: Chat) =>
    selectChat({
      id: chat.id,
      name: chat.name,
      is_group: true,
      creator_id: chat.creator_id,
      participants: chat.participants,
    });

  return (
    <div className="friends-list">
      <GroupChatList onOpenGroupChat={openGroupChat} />

      <FriendChatList onOpenProfile={openProfile} />

      <div className="bottom-sections">
        <IncomingRequests onOpenProfile={openProfile} />

        <UserSearch onOpenProfile={openProfile} />
      </div>
    </div>
  );
}
