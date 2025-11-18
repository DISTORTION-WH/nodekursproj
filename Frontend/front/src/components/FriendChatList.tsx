import React, { useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useChat } from "../context/ChatContext";
import { User } from "../types";

interface FriendChatListProps {
  onOpenProfile: (id: number) => void;
}

export default function FriendChatList({ onOpenProfile }: FriendChatListProps) {
  const [friends, setFriends] = useState<User[]>([]);
  
  const [chatIdMap, setChatIdMap] = useState<Record<number, number>>({}); 

  const { socket } = useSocket() as { socket: Socket | null };
  const { selectChat, unreadCounts } = useChat(); 

  const fetchFriends = () => {
    api
      .get<User[]>("/friends")
      .then((res) => setFriends(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    if (friends.length === 0) return;

    const fetchChatIds = async () => {
      const map: Record<number, number> = {};
      
      const promises = friends.map(async (friend) => {
        try {
      
          const res = await api.post<{ id: number }>("/chats/private", { friendId: friend.id });
          map[friend.id] = res.data.id;
        } catch (err) {
          console.error(`Error fetching chat ID for friend ${friend.id}:`, err);
        }
      });

      await Promise.all(promises);
      setChatIdMap(map);
      console.log("Chat ID Map loaded:", map);
    };

    fetchChatIds();
  }, [friends]); 


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

  const openChat = async (friend: User) => {
    try {
      let chatId = chatIdMap[friend.id];
      
      if (!chatId) {
          const res = await api.post<{ id: number }>("/chats/private", { friendId: friend.id });
          chatId = res.data.id;
          setChatIdMap(prev => ({ ...prev, [friend.id]: chatId! })); 
      }
      
      selectChat({
        id: chatId, 
        username: friend.username,
        avatar_url: friend.avatar_url || undefined,
        is_group: false,
        name: null,
        participants: [{ id: friend.id, username: friend.username }] as any
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
      {friends.map((f) => {
        const chatId = chatIdMap[f.id];
        const unreadCount = chatId ? unreadCounts[chatId] || 0 : 0;

        return (
          <div 
            key={f.id} 
            className={`friend-item ${unreadCount > 0 ? 'unread' : ''}`} 
            onClick={() => openChat(f)}
          >
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
            
            {unreadCount > 0 && ( 
              <span className="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                openChat(f);
              }}
            >
              Чат
            </button>
          </div>
        )
      })}
      {friends.length === 0 && <p>Нет друзей</p>}
    </div>
  );
}