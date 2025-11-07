import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import FriendsList from "../components/FriendsList";
import { io } from "socket.io-client"; 
import EmojiPicker, { Theme } from 'emoji-picker-react';
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); 
  const messagesEndRef = useRef(null);
  const location = useLocation();
  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: "Bearer " + token } };

  // Инициализация активного чата из навигации
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
          personalSocket.on("connect", () => {
             personalSocket.emit('join_user_room', currentUser.id);
          });
          personalSocket.on('removed_from_chat', (data) => {
              if (activeChat && Number(activeChat.id) === Number(data.chatId)) {
                  alert("Вас исключили из этого чата");
                  setActiveChat(null);
              }
          });
          return () => personalSocket.disconnect();
      }
  }, [currentUser, activeChat, token]);

  // Логика активного чата
  useEffect(() => {
    if (!activeChat?.id) return;
    setShowDeleteOptions(false);
    setModalView(null);
    setShowEmojiPicker(false); 

    // Загрузка истории
    axios.get(`/chats/${activeChat.id}/messages`, config)
      .then((res) => setMessages(res.data))
      .catch(console.error);

    // Подключение к сокету чата
    chatSocket = io(axios.defaults.baseURL);
    chatSocket.on("connect", () => {
       chatSocket.emit("join_chat", activeChat.id);
    });

    chatSocket.on("new_message", (msg) => {
        if (Number(msg.chat_id) === Number(activeChat.id)) {
             setMessages((prev) => [...prev, msg]);
        }
    });

    chatSocket.on("messages_cleared", (data) => {
        if (Number(data.chatId) === Number(activeChat.id)) {
            setMessages([]);
        }
    });

    chatSocket.on("chat_member_updated", (data) => {
        if (Number(data.chatId) === Number(activeChat.id)) {
             if (activeChat.is_group) {
                axios.get(`/chats/${activeChat.id}/users`, config)
                  .then(res => setChatMembers(res.data))
                  .catch(console.error);
             }
        }
    });

    return () => { if (chatSocket) chatSocket.disconnect(); };
  }, [activeChat]);

  // Начальная загрузка участников для группы
  useEffect(() => {
    if (activeChat && activeChat.is_group) {
      axios.get(`/chats/${activeChat.id}/users`, config)
        .then(res => setChatMembers(res.data))
        .catch(console.error);
    } else {
      setChatMembers([]); 
    }
  }, [activeChat]);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !activeChat?.id) return;
    axios.post(`/chats/${activeChat.id}/messages`, { text: newMessage }, config)
      .then(() => setNewMessage(""))
      .catch(console.error);
  };
  
  const onEmojiClick = (emojiData) => {
    setNewMessage(prevMessage => prevMessage + emojiData.emoji);
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

  // Рендер модального окна
  const renderModal = () => {
    if (!modalView) return null;
    const isInvite = modalView === 'invite';
    const list = isInvite ? friendsForInvite : chatMembers;

    return (
      <div className="modal-backdrop" onClick={() => setModalView(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">{isInvite ? "Пригласить" : "Участники"}</h3>
            <button className="modal-close-btn" onClick={() => setModalView(null)}>×</button>
          </div>
          <div className="modal-body">
            {list.map(item => (
              <div key={item.id} className="modal-item">
                <span>{item.username} {item.id === activeChat.creator_id && !isInvite ? "👑" : ""}</span>
                {isInvite ? (
                   <button className="modal-btn invite" onClick={() => handleInvite(item.id)}>Пригласить</button>
                ) : (
                   ((activeChat.creator_id === currentUser.id && item.id !== currentUser.id) || item.invited_by_user_id === currentUser.id) && 
                   <button className="modal-btn kick" onClick={() => handleKick(item.id)}>Удалить</button>
                )}
              </div>
            ))}
          </div>
          {!isInvite && (
             <div className="modal-footer">
               <button className="modal-btn invite" onClick={handleGetInviteCode}>Код приглашения</button>
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="home-page">
      <FriendsList setActiveChat={setActiveChat} currentUser={currentUser} />
      
      <div className="chat-section">
        {activeChat ? (
          <>
            <div className="chat-header">
              <div style={{display: 'flex', alignItems: 'center', minWidth: 0}}>
                 {!activeChat.is_group && (
                   <img src={activeChat.avatar_url ? axios.defaults.baseURL + activeChat.avatar_url : "/default-avatar.png"} alt="avatar" className="chat-avatar" />
                 )}
                 <h2 className="chat-title">{activeChat.username || activeChat.name}</h2>
              </div>

              <div className="chat-actions">
                {activeChat.is_group ? (
                  <>
                    <button onClick={openInviteModal} className="chat-action-btn invite">Пригласить</button>
                    <button onClick={() => setModalView('members')} className="chat-action-btn members">Участники</button>
                    <button onClick={() => handleKick(currentUser.id)} className="chat-action-btn leave">Выйти</button>
                  </>
                ) : (
                  !showDeleteOptions ? (
                    <button onClick={() => setShowDeleteOptions(true)} className="chat-action-btn leave">Очистить</button>
                  ) : (
                    <div className="delete-options">
                      <button onClick={() => deleteMessages(false)} className="chat-action-btn members">У себя</button>
                      <button onClick={() => deleteMessages(true)} className="chat-action-btn leave">У всех</button>
                      <button onClick={() => setShowDeleteOptions(false)} className="chat-action-btn">Отмена</button>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.sender_id === currentUser?.id ? "message-sender" : "message-receiver"}`}>
                  {activeChat.is_group && msg.sender_id !== currentUser?.id && <div style={{fontSize: '0.8em', opacity: 0.7}}>{msg.sender_name}</div>}
                  {msg.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input">
              {showEmojiPicker && (
                <div className="emoji-picker-container">
                  <EmojiPicker 
                    onEmojiClick={onEmojiClick} 
                    theme={Theme.DARK}  
                    lazyLoadEmojis={true}
                    style={{ width: '100%' }}
                    skinTonesDisabled={true} /* 👈 ДОБАВЛЕНО */
                  />
                </div>
              )}
              <button 
                className="emoji-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(!showEmojiPicker);
                }}
              >
                😀
              </button>
              <input 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                placeholder="Написать сообщение..." 
                onKeyDown={(e) => e.key === "Enter" && sendMessage()} 
                onClick={() => setShowEmojiPicker(false)} 
              />
              <button onClick={sendMessage}>Go</button>
            </div>
            {renderModal()}
          </>
        ) : (
          <h3 style={{ textAlign: "center", marginTop: "20px", color: "#aaa" }}>Выберите чат для начала общения</h3>
        )}
      </div>
    </div>
  );
}