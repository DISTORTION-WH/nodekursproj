import React, { useEffect, useState } from "react";
import axios from "axios";
import "./AdminPage.css";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};

  // === Пользователи ===
  useEffect(() => {
    axios.get("/admin/users", { headers: authHeaders }) // 👈 ИЗМЕНЕНО
      .then(res => setUsers(res.data))
      .catch(err => console.error("Ошибка загрузки пользователей:", err));
  }, []);

  // === Чаты ===
  useEffect(() => {
    axios.get("/admin/chats", { headers: authHeaders }) // 👈 ИЗМЕНЕНО
      .then(res => {
        const chatsData = res.data.map(c => ({
          ...c,
          participants: c.participants || [],
          messages: c.messages || []
        }));
        setChats(chatsData);
      })
      .catch(err => console.error("Ошибка загрузки чатов:", err));
  }, []);

  const openChat = (chatId) =>
    setSelectedChat(chats.find(c => Number(c.id) === Number(chatId)));

  // Удаление пользователя
  const handleDeleteUser = async (id) => {
    if (!window.confirm("Удалить пользователя?")) return;
    try {
      await axios.delete(`/admin/users/${id}`, { headers: authHeaders }); // 👈 ИЗМЕНЕНО
      setUsers(prev => prev.filter(u => Number(u.id) !== Number(id)));
    } catch (err) {
      console.error("Ошибка удаления:", err);
    }
  };

  const handleEditUser = (user) => setEditingUser({ ...user });

  const handleSaveUser = async () => {
    try {
      await axios.put(`/admin/users/${editingUser.id}`, editingUser, { headers: authHeaders }); // 👈 ИЗМЕНЕНО
      setUsers(prev => prev.map(u => Number(u.id) === Number(editingUser.id) ? editingUser : u));
      setEditingUser(null);
    } catch (err) {
      console.error("Ошибка редактирования:", err);
    }
  };

  const handleDeleteChat = async (chat) => {
    if (!window.confirm("Удалить этот чат?")) return;
    try {
      await axios.delete(`/admin/chats/${chat.id}`, { headers: authHeaders }); // 👈 ИЗМЕНЕНО
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

      {/* Пользователи */}
      <div className="admin-section">
        <h3 className="admin-subtitle">Пользователи</h3>
        <input
          type="text"
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="admin-search"
        />
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

        {editingUser && (
          <div className="edit-form">
            <h4>Редактировать пользователя</h4>
            <input type="text" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} placeholder="Имя" />
            <input type="email" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} placeholder="Email" />
            <input type="text" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} placeholder="Роль (USER, ADMIN)" />
            <button className="admin-btn save" onClick={handleSaveUser}>💾 Сохранить</button>
            <button className="admin-btn cancel" onClick={() => setEditingUser(null)}>❌ Отмена</button>
          </div>
        )}
      </div>

      {/* Чаты */}
      <div className="admin-section">
        <h3 className="admin-subtitle">Чаты</h3>
        <div className="admin-chats-list">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`admin-chat-card ${selectedChat?.id === chat.id ? "active" : ""}`}
              onClick={() => openChat(chat.id)}
            >
              <strong>Чат #{chat.id}</strong>
              <p>{chat.name || "Без названия"}</p>
              <span>{chat.participants.length} участников</span>
              <p>{chat.participants.map(u => u.username).join(", ") || "Нет участников"}</p>
              <button
                className="admin-btn delete-chat"
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteChat(chat);
                }}
              >
                ❌
              </button>
            </div>
          ))}
        </div>

        {selectedChat && (
          <div className="admin-chat-view">
            <h4>Сообщения чата #{selectedChat.id}</h4>
            <ul className="admin-chat-messages">
              {selectedChat.messages.length > 0 ? (
                selectedChat.messages.map(m => (
                  <li key={m.id} className="admin-message">
                    <strong>{m.sender?.username || "Unknown"}:</strong> {m.text}
                    <div className="msg-time">{new Date(m.created_at).toLocaleString()}</div>
                  </li>
                ))
              ) : (
                <li className="admin-message-empty">Нет сообщений</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}