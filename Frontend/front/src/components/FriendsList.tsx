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
    <div className="flex flex-col w-full h-full bg-[#2f3136] overflow-y-auto scrollbar-thin">
      
      <div className="p-3 border-b border-[#202225]">
         <GroupChatList onOpenGroupChat={openGroupChat} />
      </div>

      <div className="p-3 border-b border-[#202225]">
        <FriendChatList onOpenProfile={openProfile} />
      </div>

      <div className="p-3 border-b border-[#202225]">
        <IncomingRequests onOpenProfile={openProfile} />
        <UserSearch onOpenProfile={openProfile} />
      </div>
    </div>
  );
}