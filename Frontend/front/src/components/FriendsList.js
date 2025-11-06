import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./FriendsList.css";
import { io } from "socket.io-client"; 

let socket;

export default function FriendsList({ setActiveChat, currentUser }) {
 const [friends, setFriends] = useState([]);
 const [groupChats, setGroupChats] = useState([]); 
 const [search, setSearch] = useState("");
 const [searchResults, setSearchResults] = useState([]);
 const [incomingRequests, setIncomingRequests] = useState([]);
 const navigate = useNavigate();

 const token = localStorage.getItem("token");
 const config = { headers: { Authorization: "Bearer " + token } };

 const fetchData = () => {
  if (!token) return;
  axios.get("/friends", config).then(res => setFriends(res.data)).catch(console.error);
  axios.get("/friends/incoming", config).then(res => setIncomingRequests(res.data)).catch(console.error);
  axios.get("/chats", config).then(res => setGroupChats(res.data.filter(chat => chat.is_group))).catch(console.error);
 };

 useEffect(() => {
  fetchData(); 

  if (currentUser && currentUser.id && token) {
      if (!socket || !socket.connected) {
        socket = io(axios.defaults.baseURL);
      }

      socket.on("connect", () => {
          socket.emit('join_user_room', currentUser.id);
      });

      // 🔔 Пришел новый запрос в друзья -> обновляем входящие
      socket.on('new_friend_request', () => {
          axios.get("/friends/incoming", config).then(res => setIncomingRequests(res.data));
      });

      // 🔔 Ваш запрос приняли -> обновляем список друзей
      socket.on('friend_request_accepted', () => {
         axios.get("/friends", config).then(res => setFriends(res.data));
      });

      // 🔔 Вас удалили из друзей -> обновляем список друзей
      socket.on('friend_removed', () => {
         axios.get("/friends", config).then(res => setFriends(res.data));
      });

      // 🔔 Вас добавили в чат -> обновляем список чатов
      socket.on('added_to_chat', () => {
         axios.get("/chats", config).then(res => setGroupChats(res.data.filter(c => c.is_group)));
      });

      // 🔔 Вас исключили из чата -> убираем чат из списка
      socket.on('removed_from_chat', (data) => {
         setGroupChats(prev => prev.filter(c => Number(c.id) !== Number(data.chatId)));
      });

      return () => {
          socket.off('new_friend_request');
          socket.off('friend_request_accepted');
          socket.off('friend_removed');
          socket.off('added_to_chat');
          socket.off('removed_from_chat');
      };
  }
 }, [currentUser, token]);

 const handleSearch = () => {
  if (!search.trim()) return;
  axios.get(`/users?search=${encodeURIComponent(search)}`, config).then(res => setSearchResults(res.data)).catch(console.error);
 };

 const sendFriendRequest = (id) => {
  axios.post("/friends/request", { friendId: id }, config).then(res => {
    alert(res.data.message); setSearch(""); setSearchResults([]);
  }).catch(console.error);
 };

 const acceptRequest = (id) => {
  // После успешного ответа сервера сразу убираем из входящих, не дожидаясь сокета (для мгновенной реакции UI)
  axios.post("/friends/accept", { friendId: id }, config).then(() => {
     setIncomingRequests(prev => prev.filter(req => req.requester_id !== id));
     fetchData(); // И подтягиваем актуальный список друзей
  }).catch(console.error);
 };

 const openChat = async (friend) => {
  try {
   const res = await axios.post("/chats/private", { friendId: friend.id }, config);
   setActiveChat({ id: res.data.id, username: friend.username, avatar_url: friend.avatar_url, is_group: false });
  } catch (err) { console.error(err); }
 };
 
 const openGroupChat = (chat) => setActiveChat({ id: chat.id, name: chat.name, is_group: true, creator_id: chat.creator_id });

 const joinByCode = async () => {
  const code = prompt("Код приглашения:");
  if (!code?.trim()) return;
  try {
   const res = await axios.post("/chats/join", { inviteCode: code }, config);
   alert(`Вы вошли в: ${res.data.name}`);
   fetchData(); 
  } catch (err) { alert(err.response?.data?.message || "Ошибка"); }
 };

 const createGroupChat = async () => {
  const name = prompt("Название комнаты:");
  if (!name?.trim()) return;
  try {
   const res = await axios.post("/chats/group", { name }, config);
   setGroupChats(prev => [...prev, res.data]);
   openGroupChat(res.data);
  } catch (err) { console.error(err); }
 };

 const openProfile = (id) => navigate(`/profile/${id}`);

 return (
  <div className="friends-list">
   <div className="friends-section">
    <div className="section-header">
     <h2>Комнаты</h2>
     <div className="section-header-actions"> 
      <button onClick={joinByCode} className="group-action-btn">Join</button>
      <button onClick={createGroupChat} className="group-action-btn create">+</button>
     </div>
    </div>
    {groupChats.map(chat => <div key={chat.id} className="friend-item group-item" onClick={() => openGroupChat(chat)}><span>{chat.name}</span></div>)}
    {groupChats.length === 0 && <p>Нет комнат</p>}
   </div>
   <div className="friends-section">
    <div className="section-header"><h2>Друзья</h2></div>
    {friends.map(f => <div key={f.id} className="friend-item" onClick={() => openChat(f)}>
       <img src={f.avatar_url ? axios.defaults.baseURL + f.avatar_url : "/default-avatar.png"} alt="ava" className="avatar" onClick={(e)=>{e.stopPropagation(); openProfile(f.id)}}/>
       <span>{f.username}</span>
       <button onClick={(e) => { e.stopPropagation(); openChat(f); }}>Чат</button>
      </div>)}
    {friends.length === 0 && <p>Нет друзей</p>}
   </div>
   <div className="bottom-sections">
    <div className="incoming-section"><h3>Входящие</h3>
     {incomingRequests.length === 0 ? <p>Нет запросов</p> : incomingRequests.map(req =>
      <div key={req.requester_id} className="incoming-item">
       <img src={req.requester_avatar ? axios.defaults.baseURL + req.requester_avatar : "/default-avatar.png"} alt="ava" className="avatar" onClick={() => openProfile(req.requester_id)}/>
       <span>{req.requester_name}</span>
       <button onClick={() => acceptRequest(req.requester_id)}>Принять</button>
      </div>)}
    </div>
    <div className="search-section"><h3>Поиск</h3>
     <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Имя пользователя"/>
     <button onClick={handleSearch}>Найти</button>
     {searchResults.map(u => <div key={u.id} className="search-item">
       <img src={u.avatar_url ? axios.defaults.baseURL + u.avatar_url : "/default-avatar.png"} alt="ava" className="avatar" onClick={() => openProfile(u.id)}/>
       <span>{u.username}</span>
       <button onClick={() => sendFriendRequest(u.id)}>Добавить</button>
      </div>)}
    </div>
   </div>
  </div>
 );
}