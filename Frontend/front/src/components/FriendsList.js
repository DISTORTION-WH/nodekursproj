import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./FriendsList.css";
import { io } from "socket.io-client"; // 🆕 Импорт клиента Socket.IO

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
  axios.get("/friends", config) 
   .then(res => setFriends(res.data))
   .catch(console.error);

  axios.get("/friends/incoming", config) 
   .then(res => setIncomingRequests(res.data))
   .catch(console.error);

  axios.get("/chats", config) 
   .then(res => {
    setGroupChats(res.data.filter(chat => chat.is_group));
   })
   .catch(console.error);
 };

 // 🆕 Эффект для загрузки данных и подключения к веб-сокетам
 useEffect(() => {
  fetchData(); 

  if (currentUser && currentUser.id) {
      const socket = io(axios.defaults.baseURL);

      socket.on("connect", () => {
          socket.emit('join_user_room', currentUser.id);
      });

      socket.on('new_friend_request', (data) => {
          console.log("🔔 Получен новый запрос в друзья!", data);
          fetchData(); 
      });

      return () => {
          socket.disconnect();
      };
  }
 }, [currentUser]);

 const handleSearch = () => {
  if (!search.trim()) return;
  axios.get(`/users?search=${encodeURIComponent(search)}`, config) 
   .then(res => setSearchResults(res.data))
   .catch(console.error);
 };

 const sendFriendRequest = (friendId) => {
  axios.post("/friends/request", { friendId }, config) 
   .then(res => {
    alert(res.data.message);
    setSearch("");
    setSearchResults([]);
   })
   .catch(console.error);
 };

 const acceptRequest = (friendId) => {
  axios.post("/friends/accept", { friendId }, config) 
   .then(res => {
    alert(res.data.message);
    fetchData(); 
   })
   .catch(console.error);
 };

 const openChat = async (friend) => {
  try {
   const res = await axios.post(
    "/chats/private", 
    { friendId: friend.id },
    config
   );
   setActiveChat({
    id: res.data.id,
    username: friend.username, 
    avatar_url: friend.avatar_url, 
    is_group: false 
   });
  } catch (err) {
   console.error(err);
  }
 };
 
 const openGroupChat = (chat) => {
  setActiveChat({
   id: chat.id,
   name: chat.name, 
   is_group: true,
   creator_id: chat.creator_id 
  });
 };

 const joinByCode = async () => {
  const code = prompt("Введите код приглашения:");
  if (!code || !code.trim()) return;

  try {
   const res = await axios.post(
    "/chats/join", 
    { inviteCode: code },
    config
   );
   
   const newChat = res.data; 
   alert(`Вы присоединились к комнате: ${newChat.name || newChat.id}`);
   
   setGroupChats(prev => [...prev, newChat]);
   setActiveChat({
    id: newChat.id,
    name: newChat.name,
    is_group: true,
    creator_id: newChat.creator_id
   });

  } catch (err) {
   console.error("Ошибка входа по коду:", err);
   alert(err.response?.data?.message || "Не удалось войти по коду");
  }
 };

 const createGroupChat = async () => {
  const name = prompt("Введите название новой комнаты:");
  if (!name || !name.trim()) return;
  
  try {
   const res = await axios.post(
    "/chats/group", 
    { name }, 
    config
   );
   const newChat = res.data;
   
   setGroupChats(prev => [...prev, newChat]);
   
   setActiveChat({
    id: newChat.id,
    name: newChat.name,
    is_group: true,
    creator_id: newChat.creator_id
   });
  } catch (err) {
   console.error("Ошибка создания комнаты:", err);
   alert(err.response?.data?.message || "Не удалось создать комнату");
  }
 };

 const openProfile = (friend) => {
  navigate(`/profile/${friend.id}`);
 };

 const groupChatsEls = groupChats.map(chat =>
  <div
   key={chat.id}
   className="friend-item group-item"
   onClick={() => openGroupChat(chat)}
  >
   <span>{chat.name}</span>
  </div>
 );

 const friendsEls = friends.map(friend =>
  <div
   key={friend.id}
   className="friend-item"
   onClick={() => openChat(friend)}
   style={{ cursor: "pointer" }}
  >
   <img
    src={friend.avatar_url ? axios.defaults.baseURL + friend.avatar_url : "/default-avatar.png"}
    alt="avatar"
    className="avatar"
    onClick={(e) => {
     e.stopPropagation(); 
     openProfile(friend);
    }}
   />
   <span>{friend.username}</span>
   <button
    onClick={(e) => {
     e.stopPropagation(); 
     openChat(friend);
    }}
   >
    Чат
   </button>
  </div>
 );

 const incomingEls = incomingRequests.length === 0
  ? [<p key="no-req">Нет новых запросов</p>]
  : incomingRequests.map(req =>
   <div key={req.requester_id} className="incoming-item">
    <img
     src={req.requester_avatar ? axios.defaults.baseURL + req.requester_avatar : "/default-avatar.png"}
     alt="avatar"
     className="avatar"
     onClick={() => openProfile({ id: req.requester_id })}
    />
    <span>{req.requester_name}</span>
    <button onClick={() => acceptRequest(req.requester_id)}>Принять</button>
   </div>
  );

 const searchEls = searchResults.map(user =>
  <div key={user.id} className="search-item">
   <img
    src={user.avatar_url ? axios.defaults.baseURL + user.avatar_url : "/default-avatar.png"}
    alt="avatar"
    className="avatar"
    onClick={() => openProfile(user)}
   />
   <span>{user.username}</span>
   <button onClick={() => sendFriendRequest(user.id)}>Добавить</button>
  </div>
 );

 return (
  <div className="friends-list">
   
   <div className="friends-section">
    <div className="section-header">
     <h2>Комнаты</h2>
     <div className="section-header-actions"> 
      <button 
       onClick={joinByCode} 
       className="group-action-btn" 
       title="Войти по коду"
      >
       Join
      </button>
      <button 
       onClick={createGroupChat} 
       className="group-action-btn create" 
       title="Создать комнату"
      >
       +
      </button>
     </div>
    </div>
    {groupChats.length > 0 ? groupChatsEls : <p>Нет комнат</p>}
   </div>
   
   <div className="friends-section">
    <div className="section-header">
     <h2>Друзья</h2>
    </div>
    {friendsEls.length > 0 ? friendsEls : <p>Нет друзей</p>}
   </div>

   <div className="bottom-sections">
    <div className="incoming-section">
     <h3>Входящие запросы</h3>
     {incomingEls}
    </div>

    <div className="search-section">
     <h3>Найти новых друзей</h3>
     <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Поиск пользователя"
     />
     <button onClick={handleSearch}>Найти</button>
     {searchEls}
    </div>
   </div>
  </div>
 );
}