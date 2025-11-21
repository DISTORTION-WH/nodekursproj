import React from "react";
import { useChat } from "../context/ChatContext";
import { getImageUrl } from "../utils/imageUrl";

interface FriendChatListProps {
  onOpenProfile: (userId: number) => void;
}

export default function FriendChatList({ onOpenProfile }: FriendChatListProps) {
  const { friends, startPrivateChat, onlineUsers } = useChat();

  if (!friends || friends.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center mb-2 px-2">
           <h3 className="text-[#b9bbbe] text-xs font-bold uppercase m-0">Личные сообщения</h3>
        </div>
        <p className="text-[#b9bbbe] text-xs px-2 italic">Нет друзей</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center mb-2 px-2">
        <h3 className="text-[#b9bbbe] text-xs font-bold uppercase m-0">Личные сообщения</h3>
      </div>
      
      <ul className="list-none p-0 m-0 flex flex-col gap-0.5">
        {friends.map((f) => {
          const isOnline = onlineUsers.has(f.id);
          
          return (
            <li 
              key={f.id} 
              className="flex items-center p-2 rounded cursor-pointer text-[#8e9297] hover:bg-[#40444b] hover:text-white transition-colors group relative"
              onClick={() => {
                  console.log("Starting chat with:", f.username);
                  startPrivateChat(f.id);
              }}
            >
              <div className="relative mr-3 shrink-0 w-8 h-8">
                <img
                  src={getImageUrl(f.avatar_url)}
                  alt={f.username}
                  className="w-full h-full rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile(f.id);
                  }}
                />
                <span 
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#2f3136] ${isOnline ? 'bg-success' : 'bg-[#747f8d]'}`}
                />
              </div>

              <span className="font-medium truncate flex-1 select-none">
                {f.username}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}