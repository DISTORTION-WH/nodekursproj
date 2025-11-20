import React, { useState } from "react";
import api from "../../services/api";

export default function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      setPasswordMessage("Заполните оба поля");
      return;
    }
    setPasswordMessage("");
    setLoadingPassword(true);
    try {
      await api.put("/users/password", { oldPassword, newPassword });
      setPasswordMessage("Пароль успешно изменён");
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      setPasswordMessage(err.response?.data?.message || "Ошибка смены пароля");
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <section className="py-5 px-10 bg-[#202225] flex flex-col gap-3 shrink-0 md:p-5">
      <h3 className="m-0 font-bold text-xl mb-2">Смена пароля</h3>
      <input
        className="w-full max-w-[400px] bg-white/10 border-none p-2.5 rounded-lg text-white outline-none focus:ring-2 focus:ring-accent placeholder-[#b9bbbe]"
        type="password"
        placeholder="Старый пароль"
        value={oldPassword}
        onChange={(e) => setOldPassword(e.target.value)}
      />
      <input
        className="w-full max-w-[400px] bg-white/10 border-none p-2.5 rounded-lg text-white outline-none focus:ring-2 focus:ring-accent placeholder-[#b9bbbe]"
        type="password"
        placeholder="Новый пароль"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <div className="flex gap-2 items-center mt-2 md:flex-col md:items-stretch">
        <button
          className="bg-accent border-none text-white py-2 px-3.5 rounded-lg cursor-pointer font-bold max-w-[200px] transition-colors hover:bg-accent-hover md:max-w-full"
          onClick={handleChangePassword}
          disabled={loadingPassword}
        >
          {loadingPassword ? "Смена..." : "Сменить пароль"}
        </button>

        {passwordMessage && (
          <div className="text-success font-semibold">{passwordMessage}</div>
        )}
      </div>
    </section>
  );
}