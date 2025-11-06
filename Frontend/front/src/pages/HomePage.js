import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import FriendsList from "../components/FriendsList";
import { io } from "socket.io-client"; 
import "./HomePage.css"; 

let chatSocket;

export default function HomePage({ currentUser }) {
 const [activeChat, setActiveChat] = useState(null);
 const [messages, setMessages] = useState([]);
 const [newMessage, setNewMessage] = useState("");
 const [modalView, setModalView] = useState(null); 
 const [chatMembers, setChatMembers] = useState([]);
 const [friendsForInvite, setFriendsForInvite] = useState([]);
 const [showDeleteOptions, setShowDeleteOptions] = useState(false);
 const messagesEndRef = useRef(null);
 const location = useLocation();
 const token = localStorage.getItem("token");
 const config = { headers: { Authorization: "Bearer " + token } };

 useEffect(() => {
  if (location.state?.openChatId) {
   setActiveChat({
    id: location.state.openChatId,
    username: location.state.friend?.username,
    avatar_url: location.state.friend?.avatar_url,
    is_group: false 
   });
  }
 }, [location.state]);

  // Глобальный сокет для личных событий (кик из чата)
  useEffect(() => {
      if (currentUser && currentUser.id && token) {
          const personalSocket = io(axios.defaults.baseURL);
          personalSocket.emit('join_user_room', currentUser.id);
          personalSocket.on('removed_from_chat', (data) => {
              if (activeChat && Number(activeChat.id) === Number(data.chatId)) {
                  alert("Вас исключили из этого чата");
                  setActiveChat(null);
              }
          });
          return () => personalSocket.disconnect();
      }
  }, [currentUser, activeChat, token]);

 useEffect(() => {
  if (!activeChat?.id) return;
  setShowDeleteOptions(false);
  setModalView(null);
  axios.get(`/chats/${activeChat.id}/messages`, config).then((res) => setMessages(res.data)).catch(console.error);

    chatSocket = io(axios.defaults.baseURL);
    chatSocket.emit("join_chat", activeChat.id);

    chatSocket.on("new_message", (msg) => {
        if (Number(msg.chat_id) === Number(activeChat.id)) setMessages((prev) => [...prev, msg]);
    });

    chatSocket.on("messages_cleared", (data) => {
        if (Number(data.chatId) === Number(activeChat.id)) setMessages([]);
    });

    chatSocket.on("chat_member_updated", (data) => {
        if (Number(data.chatId) === Number(activeChat.id)) {
             axios.get(`/chats/${activeChat.id}/users`, config).then(res => setChatMembers(res.data));
        }
    });

    return () => { if (chatSocket) chatSocket.disconnect(); };
 }, [activeChat]);

 useEffect(() => {
  if (activeChat && activeChat.is_group) {
   axios.get(`/chats/${activeChat.id}/users`, config).then(res => setChatMembers(res.data)).catch(console.error);
  } else { setChatMembers([]); }
 }, [activeChat]);

 useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
 }, [messages]);

 const sendMessage = () => {
  if (!newMessage.trim() || !activeChat?.id) return;
  axios.post(`/chats/${activeChat.id}/messages`, { text: newMessage }, config).then(() => setNewMessage("")).catch(console.error);
 };
 
 const deleteMessages = async (allForEveryone) => {
  if (!activeChat?.id) return;
  if (!window.confirm(allForEveryone ? "Удалить у всех?" : "Удалить у себя?")) return;
  try {
   await axios.post(`/chats/${activeChat.id}/messages/delete`, { allForEveryone }, config);
      if (!allForEveryone) setMessages([]); 
   setShowDeleteOptions(false);
  } catch (err) { console.error(err); }
 };

 const openInviteModal = async () => {
  try {
   const res = await axios.get("/friends", config); 
   const memberIds = new Set(chatMembers.map(m => m.id));
   setFriendsForInvite(res.data.filter(f => !memberIds.has(f.id)));
   setModalView('invite');
  } catch (err) { console.error(err); }
 };
 
 const handleInvite = async (friendId) => {
  try {
   await axios.post(`/chats/${activeChat.id}/invite`, { friendId }, config);
   setModalView(null); 
  } catch (err) { alert(err.response?.data?.message || "Ошибка"); }
 };

 const handleKick = async (userIdToKick) => {
  const isLeaving = currentUser.id === userIdToKick;
  if (!window.confirm(isLeaving ? "Выйти из группы?" : "Удалить участника?")) return;
  try {
   await axios.post(`/chats/${activeChat.id}/kick`, { userIdToKick }, config);
   if (isLeaving) setActiveChat(null); 
  } catch (err) { alert(err.response?.data?.message || "Ошибка"); }
 };

 const handleGetInviteCode = async () => {
  try {
   const res = await axios.post(`/chats/${activeChat.id}/invite-code`, {}, config);
   window.prompt("Код приглашения:", res.data.inviteCode);
  } catch (err) { console.error(err); }
 };

 const messageElements = messages.map((msg) =>
  React.createElement("div", { key: msg.id, className: "message " + (msg.sender_id === currentUser?.id ? "message-sender" : "message-receiver") + " fade-in" },
   `${msg.sender_name}: ${msg.text}`
  )
 );
 
 const renderModal = () => {
  if (!modalView) return null;
    const isInvite = modalView === 'invite';
  const list = isInvite ? friendsForInvite : chatMembers;
  return React.createElement("div", { className: "modal-backdrop", onClick: () => setModalView(null) },
   React.createElement("div", { className: "modal-content", onClick: e => e.stopPropagation() },
    React.createElement("div", { className: "modal-header" },
     React.createElement("h3", { className: "modal-title" }, isInvite ? "Пригласить" : "Участники"),
     React.createElement("button", { className: "modal-close-btn", onClick: () => setModalView(null) }, "×")
    ),
    React.createElement("div", { className: "modal-body" },
     list.map(item => React.createElement("div", { key: item.id, className: "modal-item" },
      React.createElement("span", null, item.username + (item.id === activeChat.creator_id && !isInvite ? " 👑" : "")),
            isInvite ? React.createElement("button", { className: "modal-btn invite", onClick: () => handleInvite(item.id) }, "Пригласить")
              : ((activeChat.creator_id === currentUser.id && item.id !== currentUser.id) || item.invited_by_user_id === currentUser.id) && 
                React.createElement("button", { className: "modal-btn kick", onClick: () => handleKick(item.id) }, "Удалить")
     ))
    ),
        !isInvite && React.createElement("div", { className: "modal-footer" },
           React.createElement("button", { className: "modal-btn invite", onClick: handleGetInviteCode }, "Код приглашения")
        )
   )
  );
 };
 
 return React.createElement("div", { className: "home-page" },
  React.createElement(FriendsList, { setActiveChat, currentUser }),
  React.createElement("div", { className: "chat-section" },
   activeChat ? React.createElement(React.Fragment, null,
      React.createElement("div", { className: "chat-header" },
       !activeChat.is_group && React.createElement("img", { src: activeChat.avatar_url ? axios.defaults.baseURL + activeChat.avatar_url : "/default-avatar.png", className: "chat-avatar" }),
       React.createElement("h2", { className: "chat-title" }, activeChat.username || activeChat.name),
       React.createElement("div", { className: "chat-actions" },
        activeChat.is_group ? React.createElement(React.Fragment, null,
         React.createElement("button", { onClick: openInviteModal, className: "chat-action-btn invite" }, "Пригласить"),
         React.createElement("button", { onClick: () => setModalView('members'), className: "chat-action-btn members" }, "Участники"),
         React.createElement("button", { onClick: () => handleKick(currentUser.id), className: "chat-action-btn leave" }, "Выйти")
        ) : React.createElement(React.Fragment, null,
         !showDeleteOptions ? React.createElement("button", { onClick: () => setShowDeleteOptions(true), className: "chat-action-btn leave" }, "Очистить")
                    : React.createElement("div", { className: "delete-options" },
           React.createElement("button", { onClick: () => deleteMessages(false), className: "chat-action-btn members" }, "У себя"),
           React.createElement("button", { onClick: () => deleteMessages(true), className: "chat-action-btn leave" }, "У всех"),
           React.createElement("button", { onClick: () => setShowDeleteOptions(false), className: "chat-action-btn" }, "Отмена")
          )
        )
       )
      ),
      React.createElement("div", { className: "chat-messages" }, ...messageElements, React.createElement("div", { ref: messagesEndRef })),
      React.createElement("div", { className: "chat-input" },
       React.createElement("input", { value: newMessage, onChange: (e) => setNewMessage(e.target.value), placeholder: "Написать...", onKeyDown: (e) => e.key === "Enter" && sendMessage() }),
       React.createElement("button", { onClick: sendMessage }, "Отправить")
      ),
      renderModal()
     )
    : React.createElement("h3", { style: { textAlign: "center", marginTop: "20px" } }, "Выберите чат")
  )
 );
}