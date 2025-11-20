import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { User } from "../../types";

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    api.get<User[]>("/admin/users")
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
        roleId: editingUser.role === "ADMIN" ? 2 : 1, 
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

  const btnBase = "border-none py-1.5 px-2.5 rounded cursor-pointer mr-1.5 font-semibold text-sm";

  return (
    <div className="bg-[#202225] p-5 rounded-xl mb-5 md:p-4">
      <h3 className="text-xl mb-4">Пользователи</h3>
      <input
        type="text"
        placeholder="Поиск по имени или email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="p-2.5 mb-4 rounded-lg w-full max-w-[300px] bg-white/10 text-white outline-none focus:ring-2 focus:ring-accent"
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse mb-4 min-w-[600px]">
          <thead>
            <tr>
              <th className="bg-black/20 font-semibold text-[#b9bbbe] p-3 text-left border-b border-white/10">ID</th>
              <th className="bg-black/20 font-semibold text-[#b9bbbe] p-3 text-left border-b border-white/10">Имя</th>
              <th className="bg-black/20 font-semibold text-[#b9bbbe] p-3 text-left border-b border-white/10">Email</th>
              <th className="bg-black/20 font-semibold text-[#b9bbbe] p-3 text-left border-b border-white/10">Роль</th>
              <th className="bg-black/20 font-semibold text-[#b9bbbe] p-3 text-left border-b border-white/10">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td className="p-3 border-b border-white/10">{user.id}</td>
                <td className="p-3 border-b border-white/10">{user.username || "—"}</td>
                <td className="p-3 border-b border-white/10">{user.email || "—"}</td>
                <td className="p-3 border-b border-white/10">{user.roles?.join(", ") || user.role || "—"}</td>
                <td className="p-3 border-b border-white/10">
                  <button className={`${btnBase} bg-accent text-white hover:bg-accent-hover`} onClick={() => handleEditUser(user)}>✏️</button>
                  <button className={`${btnBase} bg-danger text-white hover:bg-danger-hover`} onClick={() => handleDeleteUser(user.id)}>❌</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="flex flex-col gap-2.5 bg-white/5 p-4 rounded-lg mt-5">
          <h4 className="m-0 mb-2">Редактировать пользователя</h4>
          <input className="p-2 rounded-md bg-white/10 text-white border-none" type="text" value={editingUser.username} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} placeholder="Имя" />
          <input className="p-2 rounded-md bg-white/10 text-white border-none" type="email" value={editingUser.email || ""} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} placeholder="Email" />
          <input className="p-2 rounded-md bg-white/10 text-white border-none" type="text" value={editingUser.role || ""} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })} placeholder="Роль (USER, ADMIN)" />
          <div className="mt-2.5">
            <button className={`${btnBase} bg-success text-white hover:opacity-90`} onClick={handleSaveUser}>💾 Сохранить</button>
            <button className={`${btnBase} bg-danger text-white hover:bg-danger-hover`} onClick={() => setEditingUser(null)}>❌ Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}