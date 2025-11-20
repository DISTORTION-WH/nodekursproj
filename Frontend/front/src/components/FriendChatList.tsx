import React, { useEffect, useState } from "react";
import { useChat } from "../context/ChatContext";
import { getImageUrl } from "../utils/imageUrl";

interface FriendChatListProps {
  onOpenProfile: (userId: number) => void;
}

export default function FriendChatList({ onOpenProfile }: FriendChatListProps) {
  const { friends, startPrivateChat, onlineUsers } = useChat();
  const [localFriends, setLocalFriends] = useState(friends);

  useEffect(() => {
    setLocalFriends(friends);
  }, [friends]);

  if (localFriends.length === 0) {
    return (
      <div>
        <h3 className="flex justify-between items-center mb-2.5 text-text-muted text-sm uppercase font-bold">
          Личные сообщения
        </h3>
        <p className="text-text-muted text-sm italic">Нет друзей</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <h3 className="flex justify-between items-center mb-2.5 text-text-muted text-sm uppercase font-bold">
        Личные сообщения
      </h3>
      <ul className="list-none p-0 m-0">
        {localFriends.map((f) => {
          const isOnline = onlineUsers.has(f.id);
          return (
            <li 
              key={f.id} 
              className="flex items-center p-2 rounded cursor-pointer transition-colors text-[#8e9297] mb-0.5 hover:bg-bg-hover hover:text-white relative group"
              onClick={() => startPrivateChat(f.id)}
            >
              <div className="relative mr-2.5 shrink-0">
                <img
                  src={getImageUrl(f.avatar_url)}
                  alt={f.username}
                  className="w-8 h-8 rounded-full object-cover block"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile(f.id);
                  }}
                />
                <span 
                  className={`absolute bottom-[-2px] right-[-2px] w-3 h-3 rounded-full border-2 border-bg group-hover:border-bg-hover ${isOnline ? 'bg-success' : 'bg-text-muted'}`}
                />
              </div>
              <span className="font-medium overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                {f.username}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}