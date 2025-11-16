// Frontend/front/src/components/admin/UserManagement.js
import React, { useState, useEffect } from "react";
import axios from "axios";

// Мы можем использовать тот же CSS, так как классы не пересекаются
import "../../pages/AdminPage.css";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, []);

  const fetchUsers = () => {
    axios
      .get("/admin/users", { headers: authHeaders })
      .then((res) => setUsers(res.data))
      .catch((err) => console.error("Ошибка загрузки пользователей:", err));
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Удалить пользователя?")) return;
    try {
      await axios.delete(`/admin/users/${id}`, { headers: authHeaders });
      setUsers((prev) => prev.filter((u) => Number(u.id) !== Number(id)));
    } catch (err) {
      console.error("Ошибка удаления:", err);
    }
  };

  const handleEditUser = (user) => setEditingUser({ ...user });

  const handleSaveUser = async () => {
    try {
      // ИСПРАВЛЕНИЕ: AdminPage.js неправильно обрабатывал `role`.
      // Бэкенд (userService.updateUser) ожидает `roleId`, а не `role`.
      // Мы должны сначала найти ID роли (1 для 'USER', 2 для 'ADMIN')
      // Но для простоты, т.к. у нас нет доступа к списку ролей,
      // отправим `roleId` как 1 или 2.
      // Этого поля нет в `editingUser`, поэтому мы его пропускаем.
      // Бэкенд ожидает { username, roleId, email }

      // В `adminController.updateUser` передаются `username, roleId, email`.
      // В `AdminPage.js` `editingUser.role` - это строка "USER" или "ADMIN".
      // `userService.updateUser` ожидает `roleId`.
      // Это было ошибкой в `AdminPage.js`.
      // Давайте пока оставим как было, чтобы не ломать логику,
      // но в идеале нужно передавать roleId.

      const dataToUpdate = {
        username: editingUser.username,
        email: editingUser.email,
        // `roleId` не `role`. Если бэкенд ожидает `roleId`,
        // нам нужно преобразовать "ADMIN" -> 2, "USER" -> 1.
        // Судя по `adminController`, он ожидает `roleId`.
        // В `userService.updateUser` он ожидает `roleId`.
        // В `AdminPage` вы редактировали `role` (строку).
        // Это несоответствие. Давайте отправим то, что было:
        roleId: editingUser.role === "ADMIN" ? 2 : 1, // Простое предположение
      };

      await axios.put(`/admin/users/${editingUser.id}`, dataToUpdate, {
        headers: authHeaders,
      });

      // Обновляем локальное состояние
      setUsers((prev) =>
        prev.map((u) =>
          Number(u.id) === Number(editingUser.id)
            ? { ...editingUser, role: editingUser.role } // Сохраняем `role` (строку)
            : u
        )
      );
      setEditingUser(null);
    } catch (err) {
      console.error("Ошибка редактирования:", err);
    }
  };

  const filteredUsers = users.filter((u) => {
    const username = u.username?.toLowerCase() || "";
    const email = u.email?.toLowerCase() || "";
    return (
      username.includes(search.toLowerCase()) ||
      email.includes(search.toLowerCase())
    );
  });

  return (
    <div className="admin-section">
      <h3 className="admin-subtitle">Пользователи</h3>
      <input
        type="text"
        placeholder="Поиск по имени или email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="admin-search"
      />

      <div className="admin-table-wrapper">
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
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username || "—"}</td>
                <td>{user.email || "—"}</td>
                <td>{user.roles?.join(", ") || user.role || "—"}</td>
                <td>
                  <button
                    className="admin-btn edit"
                    onClick={() => handleEditUser(user)}
                  >
                    ✏️
                  </button>
                  <button
                    className="admin-btn delete"
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="edit-form">
          <h4>Редактировать пользователя</h4>
          <input
            type="text"
            value={editingUser.username}
            onChange={(e) =>
              setEditingUser({ ...editingUser, username: e.target.value })
            }
            placeholder="Имя"
          />
          <input
            type="email"
            value={editingUser.email}
            onChange={(e) =>
              setEditingUser({ ...editingUser, email: e.target.value })
            }
            placeholder="Email"
          />
          <input
            type="text"
            value={editingUser.role}
            onChange={(e) =>
              setEditingUser({ ...editingUser, role: e.target.value })
            }
            placeholder="Роль (USER, ADMIN)"
          />
          <div style={{ marginTop: 10 }}>
            <button className="admin-btn save" onClick={handleSaveUser}>
              💾 Сохранить
            </button>
            <button
              className="admin-btn cancel"
              onClick={() => setEditingUser(null)}
            >
              ❌ Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
