import React, { useState } from "react";
import api from "../../services/api";

export default function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      setPasswordMessage("Заполните оба поля");
      setIsSuccess(false);
      return;
    }
    setPasswordMessage("");
    setLoadingPassword(true);
    try {
      await api.put("/users/password", { oldPassword, newPassword });
      setPasswordMessage("Пароль успешно изменён");
      setIsSuccess(true);
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      setPasswordMessage(err.response?.data?.message || "Ошибка смены пароля");
      setIsSuccess(false);
    } finally {
      setLoadingPassword(false);
    }
  };

  const inputClass =
    "bg-discord-input text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-discord-accent placeholder-discord-text-muted w-full text-sm";

  return (
    <div className="bg-discord-secondary rounded-xl p-6">
      <h3 className="text-white font-semibold text-base mb-3">Смена пароля</h3>
      <div className="flex flex-col gap-3 max-w-sm">
        <input
          type="password"
          placeholder="Старый пароль"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Новый пароль"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <button
          onClick={handleChangePassword}
          disabled={loadingPassword}
          className="bg-discord-accent hover:bg-discord-accent-hover text-white text-sm font-semibold py-2 rounded transition disabled:opacity-50 w-fit px-4"
        >
          {loadingPassword ? "Смена..." : "Сменить пароль"}
        </button>
        {passwordMessage && (
          <p
            className={`text-xs ${
              isSuccess ? "text-discord-success" : "text-discord-danger"
            }`}
          >
            {passwordMessage}
          </p>
        )}
      </div>
    </div>
  );
}
