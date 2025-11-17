import React, { useState, useEffect } from "react";
import api from "../../services/api";
import "../../pages/AdminPage.css";
import { User } from "../../types";

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    api
      .get<User[]>("/admin/users")
      .then((res) => setUsers(res.data))
      .catch((err) => console.error("Ошибка загрузки пользователей:", err));
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm("Удалить пользователя?")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers((prev) => prev.filter((u) => Number(u.id) !== Number(id)));
    } catch (err) {
      console.error("Ошибка удаления:", err);
    }
  };

  const handleEditUser = (user: User) => setEditingUser({ ...user });

  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      const dataToUpdate = {
        username: editingUser.username,
        email: editingUser.email,
        roleId: editingUser.role === "ADMIN" ? 2 : 1, // Пример логики, возможно нужно поправить под ваш бекенд
      };

      await api.put(`/admin/users/${editingUser.id}`, dataToUpdate);

      setUsers((prev) =>
        prev.map((u) =>
          Number(u.id) === Number(editingUser.id)
            ? { ...editingUser, role: editingUser.role }
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
            value={editingUser.email || ""}
            onChange={(e) =>
              setEditingUser({ ...editingUser, email: e.target.value })
            }
            placeholder="Email"
          />
          <input
            type="text"
            value={editingUser.role || ""}
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