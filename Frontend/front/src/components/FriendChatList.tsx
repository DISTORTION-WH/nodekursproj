import React from "react";
import { useChat } from "../context/ChatContext";
import "./FriendsList.css"; 

export default function FriendChatList() {
  const { chats, enterChat, unreadChats } = useChat();
  const friendChats = chats.filter(c => !c.isGroup);

  return (
    <div className="friends-list">
      <h3>Диалоги</h3>
      {friendChats.length === 0 ? (
        <p style={{ padding: "10px", color: "#ccc" }}>Нет диалогов</p>
      ) : (
        <ul>
          {friendChats.map((chat) => {
            const isUnread = unreadChats.has(chat.id);

            return (
              <li 
                key={chat.id} 
                onClick={() => enterChat(chat.id)}
                className={isUnread ? "chat-item unread" : "chat-item"}
                style={{ 
                    cursor: "pointer", 
                    padding: "10px", 
                    borderBottom: "1px solid #333",
                    backgroundColor: isUnread ? "rgba(255, 0, 0, 0.1)" : "transparent", // Легкая подсветка фона
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: "bold", color: "#fff" }}>
                        {chat.name || "Без названия"}
                    </span>
                    <span style={{ 
                        fontSize: "12px", 
                        color: isUnread ? "#fff" : "#aaa",
                        fontWeight: isUnread ? "bold" : "normal" 
                    }}>
                        {chat.lastMessage 
                           ? (chat.lastMessage.length > 20 ? chat.lastMessage.slice(0,20)+"..." : chat.lastMessage) 
                           : "Нет сообщений"}
                    </span>
                </div>
                
                {isUnread && (
                    <div style={{
                        width: "10px",
                        height: "10px",
                        backgroundColor: "#ff4d4d",
                        borderRadius: "50%",
                        boxShadow: "0 0 5px #ff4d4d"
                    }}></div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}