import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./FriendsList.css";

// Этот компонент теперь принимает currentUser, чтобы знать ID для создания групп
export default function FriendsList({ setActiveChat, currentUser }) {
  const [friends, setFriends] = useState([]);
  const [groupChats, setGroupChats] = useState([]); // Новое состояние для групп
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: "Bearer " + token } };

  // Функция для загрузки всех данных
  const fetchData = () => {
    // Загружаем друзей
    axios.get("/friends", config)
      .then(res => setFriends(res.data))
      .catch(console.error);

    // Загружаем входящие запросы
    axios.get("/friends/incoming", config)
      .then(res => setIncomingRequests(res.data))
      .catch(console.error);

    // Загружаем все чаты пользователя (и приватные, и группы)
    axios.get("/chats", config)
      .then(res => {
        // Фильтруем по типу чата
        setGroupChats(res.data.filter(chat => chat.is_group));
      })
      .catch(console.error);
  };

  // Загружаем данные при первом рендере
  useEffect(() => {
    fetchData();
  }, []);

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
        fetchData(); // Перезагружаем все данные
      })
      .catch(console.error);
  };

  // Открытие приватного чата
  const openChat = async (friend) => {
    try {
      const res = await axios.post(
        "/chats/private",
        { friendId: friend.id },
        config
      );
      setActiveChat({
        id: res.data.id,
        username: friend.username, // Для хедера чата
        avatar_url: friend.avatar_url, // Для хедера чата
        is_group: false // Явно указываем, что это не группа
      });
    } catch (err) {
      console.error(err);
    }
  };
  
  // Открытие группового чата
  const openGroupChat = (chat) => {
    setActiveChat({
      id: chat.id,
      name: chat.name, // У групп есть 'name'
      is_group: true,
      creator_id: chat.creator_id // Передаем ID создателя
    });
  };

  // Новая функция: Присоединиться к комнате по коду
  const joinByCode = async () => {
    const code = prompt("Введите код приглашения:");
    if (!code || !code.trim()) return;

    try {
      const res = await axios.post(
        "/chats/join",
        { inviteCode: code },
        config
      );
      
      const newChat = res.data; // Бэкенд возвращает данные чата
      alert(`Вы присоединились к комнате: ${newChat.name || newChat.id}`);
      
      // Обновляем список групп и сразу открываем этот чат
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

  // Новая функция: Создание группового чата
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
      
      // Добавляем новый чат в список
      setGroupChats(prev => [...prev, newChat]);
      
      // Сразу открываем созданный чат
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

  // --- Рендер списков ---

  // Рендер списка ГРУПП
  const groupChatsEls = groupChats.map(chat =>
    <div
      key={chat.id}
      className="group-item" // Используем .group-item из CSS
      onClick={() => openGroupChat(chat)}
    >
      {/* ❗️ ИСПРАВЛЕНО: Добавлен span для стилей */}
      <span>{chat.name}</span> 
    </div>
  );

  // Рендер списка ДРУЗЕЙ (для ЛС)
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
    ? [<p key="no-req" className="fl-empty">Нет новых запросов</p>] // ❗️ Добавлен класс
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
      
      {/* --- ВЕРХНЯЯ ЧАСТЬ (С ПРОКРУТКОЙ) --- */}
      {/* ❗️❗️ ИЗМЕНЕНИЕ: Добавлена обертка .top-scrollable-sections */}
      <div className="top-scrollable-sections">
        {/* Секция Групповых чатов */}
        <div className="rooms-section"> {/* ❗️ Изменен класс */}
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
          {/* ❗️ Рендерим div'ы прямо здесь */}
          {groupChats.length > 0 ? groupChatsEls : <p className="fl-empty">Нет комнат</p>}
        </div>
        
        {/* Секция Друзей (ЛС) */}
        <div className="friends-section"> {/* ❗️ Изменен класс */}
          <div className="section-header">
            <h2>Друзья</h2>
          </div>
          {/* ❗️ Рендерим div'ы прямо здесь */}
          {friendsEls.length > 0 ? friendsEls : <p className="fl-empty">Нет друзей</p>}
        </div>
      </div> {/* ❗️ Конец .top-scrollable-sections */}


      {/* --- НИЖНЯЯ ЧАСТЬ (ПРИЖАТА К НИЗУ) --- */}
      <div className="bottom-sections">
        <div className="incoming-section">
          <h3>Входящие запросы</h3>
          {/* ❗️❗️ ИЗМЕНЕНИЕ: Добавлена обертка .scrollable-list */}
          <div className="scrollable-list">
            {incomingEls}
          </div>
        </div>

        <div className="search-section">
          <h3>Найти новых друзей</h3>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск пользователя"
          />
          <button onClick={handleSearch}>Найти</button>
          {/* ❗️❗️ ИЗМЕНЕНИЕ: Добавлена обертка .scrollable-list */}
          <div className="scrollable-list">
            {searchEls}
          </div>
        </div>
      </div>
    </div>
  );
}