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
    <div className="w-[280px] min-w-[250px] bg-bg flex flex-col border-r border-bg-block overflow-y-auto h-full shrink-0 scrollbar-thin md:w-full md:border-r-0 md:absolute md:top-0 md:left-0 md:z-10 md:transition-transform md:duration-300">
      
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