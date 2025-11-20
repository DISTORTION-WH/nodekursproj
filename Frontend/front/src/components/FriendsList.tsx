import React from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "../context/ChatContext";
import IncomingRequests from "./IncomingRequests";
import UserSearch from "./UserSearch";
import GroupChatList from "./GroupChatList";
import FriendChatList from "./FriendChatList";
import { User } from "../types";

interface FriendsListProps {
  currentUser: User | null;
}

export default function FriendsList({ currentUser }: FriendsListProps) {
  const { openGroupChat } = useChat();
  const navigate = useNavigate();

  const openProfile = (userId: number) => {
    navigate(`/profile/${userId}`);
  };

  return (
    // Ширина и позиционирование контролируются в HomePage.tsx. 
    // Здесь только внутреннее наполнение: flex-col, скролл, фон.
    <div className="flex flex-col w-full h-full bg-bg overflow-y-auto scrollbar-thin">
      
      <div className="p-4 border-b border-bg-block md:p-2.5 md:px-4">
         <GroupChatList onOpenGroupChat={openGroupChat} />
      </div>

      <div className="p-4 border-b border-bg-block md:p-2.5 md:px-4">
        <FriendChatList onOpenProfile={openProfile} />
      </div>

      <div className="p-4 border-b border-bg-block md:p-2.5 md:px-4">
        <IncomingRequests onOpenProfile={openProfile} />
        <UserSearch onOpenProfile={openProfile} />
      </div>
    </div>
  );
}