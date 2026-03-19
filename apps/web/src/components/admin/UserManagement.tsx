import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { User } from "../../types";

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => { fetchUsers(); }, []);

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
    } catch (err) { console.error("Ошибка удаления:", err); }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      await api.put(`/admin/users/${editingUser.id}`, {
        username: editingUser.username,
        email: editingUser.email,
        role: editingUser.role,
      });
      setUsers((prev) =>
        prev.map((u) => Number(u.id) === Number(editingUser.id) ? { ...editingUser } : u)
      );
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      alert("Не удалось обновить пользователя. Проверьте правильность роли (USER, ADMIN, MODERATOR)");
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (u.username?.toLowerCase() || "").includes(q) || (u.email?.toLowerCase() || "").includes(q);
  });

  const inputClass = "bg-discord-input text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-discord-accent placeholder-discord-text-muted text-sm w-full";

  return (
    <div className="bg-discord-secondary rounded-xl p-5">
      <h3 className="text-white font-semibold text-base mb-4">Пользователи</h3>

      <input
        type="text"
        placeholder="Поиск по имени или email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${inputClass} mb-4`}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-discord-text-secondary">
          <thead>
            <tr className="text-discord-text-muted text-xs uppercase border-b border-discord-tertiary">
              <th className="text-left py-2 px-2">ID</th>
              <th className="text-left py-2 px-2">Имя</th>
              <th className="text-left py-2 px-2">Email</th>
              <th className="text-left py-2 px-2">Роль</th>
              <th className="text-left py-2 px-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-discord-tertiary hover:bg-discord-input transition">
                <td className="py-2 px-2 text-discord-text-muted">{user.id}</td>
                <td className="py-2 px-2 text-white">{user.username || "—"}</td>
                <td className="py-2 px-2">{user.email || "—"}</td>
                <td className="py-2 px-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    user.role === "ADMIN" ? "bg-discord-danger/20 text-discord-danger" :
                    user.role === "MODERATOR" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-white/10 text-discord-text-secondary"
                  }`}>
                    {user.role || "USER"}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingUser({ ...user })}
                      className="bg-discord-accent/20 hover:bg-discord-accent text-discord-accent hover:text-white text-xs px-2 py-1 rounded transition"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="bg-discord-danger/20 hover:bg-discord-danger text-discord-danger hover:text-white text-xs px-2 py-1 rounded transition"
                    >
                      ❌
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="mt-4 bg-discord-tertiary rounded-xl p-4 flex flex-col gap-3">
          <h4 className="text-white font-semibold text-sm">Редактировать пользователя</h4>
          <input
            type="text"
            value={editingUser.username}
            onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
            placeholder="Имя"
            className={inputClass}
          />
          <input
            type="email"
            value={editingUser.email || ""}
            onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
            placeholder="Email"
            className={inputClass}
          />
          <input
            type="text"
            value={editingUser.role || ""}
            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
            placeholder="Роль (USER, ADMIN, MODERATOR)"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveUser}
              className="bg-discord-success hover:bg-discord-success-hover text-white text-sm px-3 py-1.5 rounded transition"
            >
              💾 Сохранить
            </button>
            <button
              onClick={() => setEditingUser(null)}
              className="bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary hover:text-white text-sm px-3 py-1.5 rounded transition"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
