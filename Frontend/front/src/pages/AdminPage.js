import React, { useEffect, useState } from "react";
import axios from "axios";
import "./AdminPage.css";

export default function AdminPage() {
 const [users, setUsers] = useState([]);
 const [chats, setChats] = useState([]);
 const [stats, setStats] = useState(null); // 🆕
 const [logs, setLogs] = useState([]);     // 🆕
 const [activeTab, setActiveTab] = useState("users"); // 🆕
 
 const [search, setSearch] = useState("");
 const [editingUser, setEditingUser] = useState(null);
 const [selectedChat, setSelectedChat] = useState(null);

 const token = localStorage.getItem("token");
 const authHeaders = token ? { Authorization: "Bearer " + token } : {};

 // Загрузка данных в зависимости от активной вкладки
 useEffect(() => {
  if (activeTab === "users" && users.length === 0) {
    fetchUsers();
  } else if (activeTab === "chats" && chats.length === 0) {
    fetchChats();
  } else if (activeTab === "stats") {
    fetchStats();
  } else if (activeTab === "logs") {
    fetchLogs();
  }
  // eslint-disable-next-line
 }, [activeTab]);

 const fetchUsers = () => {
   axios.get("/admin/users", { headers: authHeaders })
     .then(res => setUsers(res.data))
     .catch(err => console.error("Ошибка загрузки пользователей:", err));
 };

 const fetchChats = () => {
   axios.get("/admin/chats", { headers: authHeaders })
     .then(res => {
       // Если бэкенд возвращает простой список без participants/messages, 
       // нужно убедиться, что поля существуют, чтобы не ломать UI
       const chatsData = res.data.map(c => ({
        ...c,
        participants: c.participants || [],
        messages: c.messages || []
       }));
       setChats(chatsData);
     })
     .catch(err => console.error("Ошибка загрузки чатов:", err));
 };

 const fetchStats = () => { // 🆕
    axios.get("/admin/stats", { headers: authHeaders })
      .then(res => setStats(res.data))
      .catch(err => console.error("Ошибка загрузки статистики:", err));
 };

 const fetchLogs = () => { // 🆕
    axios.get("/admin/logs?limit=50", { headers: authHeaders })
      .then(res => setLogs(res.data))
      .catch(err => console.error("Ошибка загрузки логов:", err));
 };

 const openChat = (chatId) =>
  setSelectedChat(chats.find(c => Number(c.id) === Number(chatId)));

 const handleDeleteUser = async (id) => {
  if (!window.confirm("Удалить пользователя?")) return;
  try {
   await axios.delete(`/admin/users/${id}`, { headers: authHeaders });
   setUsers(prev => prev.filter(u => Number(u.id) !== Number(id)));
  } catch (err) {
   console.error("Ошибка удаления:", err);
  }
 };

 const handleEditUser = (user) => setEditingUser({ ...user });

 const handleSaveUser = async () => {
  try {
   await axios.put(`/admin/users/${editingUser.id}`, editingUser, { headers: authHeaders });
   setUsers(prev => prev.map(u => Number(u.id) === Number(editingUser.id) ? editingUser : u));
   setEditingUser(null);
  } catch (err) {
   console.error("Ошибка редактирования:", err);
  }
 };

 const handleDeleteChat = async (chat) => {
  if (!window.confirm("Удалить этот чат?")) return;
  try {
   await axios.delete(`/admin/chats/${chat.id}`, { headers: authHeaders });
   setChats(prev => prev.filter(c => Number(c.id) !== Number(chat.id)));
   if (selectedChat?.id === chat.id) setSelectedChat(null);
  } catch (err) {
   console.error("Ошибка удаления чата:", err);
  }
 };

 const filteredUsers = users.filter(u => {
  const username = u.username?.toLowerCase() || "";
  const email = u.email?.toLowerCase() || "";
  return username.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
 });

 return (
  <div className="admin-page">
   <h2 className="admin-title">Админ-панель</h2>

   {/* 🆕 Навигация по вкладкам */}
   <div className="admin-tabs">
      <button className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}>Пользователи</button>
      <button className={activeTab === "chats" ? "active" : ""} onClick={() => setActiveTab("chats")}>Чаты</button>
      <button className={activeTab === "stats" ? "active" : ""} onClick={() => setActiveTab("stats")}>Статистика</button>
      <button className={activeTab === "logs" ? "active" : ""} onClick={() => setActiveTab("logs")}>Логи</button>
   </div>

   {/* === Вкладка Пользователи === */}
   {activeTab === "users" && (
    <div className="admin-section">
        <h3 className="admin-subtitle">Пользователи</h3>
        <input
        type="text"
        placeholder="Поиск по имени или email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="admin-search"
        />
        <div style={{overflowX: 'auto'}}>
            <table className="admin-table">
            <thead>
            <tr>
            <th>ID</th>
            <th>Имя</th>
            <th>Email</th>
            <th>Роль</th>
            <th>Действия</th>
            </tr>
            </thead>
            <tbody>
            {filteredUsers.map(user => (
            <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username || "—"}</td>
                <td>{user.email || "—"}</td>
                <td>{user.roles?.join(", ") || user.role || "—"}</td>
                <td>
                <button className="admin-btn edit" onClick={() => handleEditUser(user)}>✏️</button>
                <button className="admin-btn delete" onClick={() => handleDeleteUser(user.id)}>❌</button>
                </td>
            </tr>
            ))}
            </tbody>
            </table>
        </div>

        {editingUser && (
        <div className="edit-form">
        <h4>Редактировать пользователя</h4>
        <input type="text" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} placeholder="Имя" />
        <input type="email" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} placeholder="Email" />
        <input type="text" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} placeholder="Роль (USER, ADMIN)" />
        <div style={{marginTop: 10}}>
            <button className="admin-btn save" onClick={handleSaveUser}>💾 Сохранить</button>
            <button className="admin-btn cancel" onClick={() => setEditingUser(null)}>❌ Отмена</button>
        </div>
        </div>
        )}
    </div>
   )}

   {/* === Вкладка Чаты === */}
   {activeTab === "chats" && (
    <div className="admin-section">
        <h3 className="admin-subtitle">Чаты</h3>
        <div className="admin-chats-list">
        {chats.map(chat => (
        <div
        key={chat.id}
        className={`admin-chat-card ${selectedChat?.id === chat.id ? "active" : ""}`}
        onClick={() => openChat(chat.id)}
        >
        <strong>#{chat.id} {chat.name ? chat.name : (chat.is_group ? 'Группа' : 'ЛС')}</strong>
        <p>{chat.is_group ? "Групповой" : "Личный"}</p>
        <span>{chat.participants?.length || 0} участников</span>
        <button
            className="admin-btn delete-chat"
            onClick={e => {
            e.stopPropagation();
            handleDeleteChat(chat);
            }}
        >
            ❌ Удалить
        </button>
        </div>
        ))}
        </div>

        {selectedChat && (
        <div className="admin-chat-view">
        <h4>Сообщения чата #{selectedChat.id}</h4>
        <ul className="admin-chat-messages">
        {selectedChat.messages && selectedChat.messages.length > 0 ? (
            selectedChat.messages.map(m => (
            <li key={m.id} className="admin-message">
            <strong>{m.sender?.username || "Unknown"}:</strong> {m.text}
            <div className="msg-time">{new Date(m.created_at).toLocaleString()}</div>
            </li>
            ))
        ) : (
            <li className="admin-message-empty">Нет сообщений (или они не подгружены)</li>
        )}
        </ul>
        </div>
        )}
    </div>
   )}

   {/* 🆕 === Вкладка Статистика === */}
   {activeTab === "stats" && stats && (
      <div className="admin-section">
        <h3 className="admin-subtitle">Статистика приложения</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Пользователей</h4>
            <p>{stats.usersCount}</p>
          </div>
          <div className="stat-card">
            <h4>Чатов</h4>
            <p>{stats.chatsCount}</p>
          </div>
          <div className="stat-card">
            <h4>Сообщений</h4>
            <p>{stats.messagesCount}</p>
          </div>
          <div className="stat-card error">
            <h4>Ошибок в логах</h4>
            <p>{stats.logsCount}</p>
          </div>
        </div>
      </div>
    )}

    {/* 🆕 === Вкладка Логи === */}
    {activeTab === "logs" && (
      <div className="admin-section">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
            <h3 className="admin-subtitle" style={{marginBottom: 0}}>Последние системные логи (50)</h3>
            <button className="admin-btn save" onClick={fetchLogs}>🔄 Обновить</button>
        </div>
        <div style={{overflowX: 'auto'}}>
            <table className="admin-table logs-table">
            <thead>
                <tr>
                <th>Время</th>
                <th>Уровень</th>
                <th>Сообщение</th>
                <th>Детали</th>
                </tr>
            </thead>
            <tbody>
                {logs.map(log => (
                <tr key={log.id} className={`log-row ${log.level.toLowerCase()}`}>
                    <td style={{whiteSpace: 'nowrap'}}>{new Date(log.created_at).toLocaleString()}</td>
                    <td><span className={`log-badge ${log.level.toLowerCase()}`}>{log.level}</span></td>
                    <td style={{maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis'}} title={log.message}>{log.message}</td>
                    <td>
                    {log.meta && Object.keys(log.meta).length > 0 && (
                        <details>
                        <summary style={{cursor: 'pointer', color: 'var(--accent)'}}>JSON</summary>
                        <pre style={{fontSize: '0.75rem', textAlign: 'left', marginTop: 5}}>
                            {JSON.stringify(log.meta, null, 2)}
                        </pre>
                        </details>
                    )}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
    )}

  </div>
 );
}