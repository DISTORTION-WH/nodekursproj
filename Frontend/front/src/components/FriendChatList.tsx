import React from "react";
import { useChat } from "../context/ChatContext";
import "./FriendsList.css"; 

export default function FriendChatList() {
  const { chats, enterChat, unreadChats } = useChat();
  // Фильтруем только личные чаты (или все, если хотите и группы тут)
  const displayChats = chats.filter(c => !c.isGroup);

  return (
    <div className="friends-list-section">
      <h3 style={{ padding: "0 10px", color: "#b9bbbe", fontSize: "0.9rem", textTransform: "uppercase" }}>
        Диалоги
      </h3>
      {displayChats.length === 0 ? (
        <p style={{ padding: "10px", color: "#ccc" }}>Нет диалогов</p>
      ) : (
        <ul>
          {displayChats.map((chat) => {
            const isUnread = unreadChats.has(chat.id);

            return (
              <li 
                key={chat.id} 
                onClick={() => enterChat(chat.id)}
                className="friend-item"
                style={{ 
                    justifyContent: "space-between",
                    backgroundColor: isUnread ? "rgba(88, 101, 242, 0.1)" : "transparent"
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ 
                        fontWeight: isUnread ? "bold" : "normal", 
                        color: isUnread ? "#fff" : "#8e9297" 
                    }}>
                        {chat.name || "Без названия"}
                    </span>
                </div>
                
                {isUnread && (
                    <div style={{
                        width: "10px",
                        height: "10px",
                        backgroundColor: "#ed4245", // Яркий красный
                        borderRadius: "50%",
                        boxShadow: "0 0 5px #ed4245",
                        flexShrink: 0,
                        marginLeft: "10px"
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