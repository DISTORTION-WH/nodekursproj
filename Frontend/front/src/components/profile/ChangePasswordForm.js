import React, { useState } from "react";
import api from "../../services/api";
import "../../pages/ProfilePage.css";

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
    } catch (err) {
      setPasswordMessage(err.response?.data?.message || "Ошибка смены пароля");
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <section className="profile-password-section">
      <h3 className="password-title">Смена пароля</h3>
      <input
        className="password-input"
        type="password"
        placeholder="Старый пароль"
        value={oldPassword}
        onChange={(e) => setOldPassword(e.target.value)}
      />
      <input
        className="password-input"
        type="password"
        placeholder="Новый пароль"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <div className="password-buttons-wrapper">
        <button
          className="password-btn"
          onClick={handleChangePassword}
          disabled={loadingPassword}
        >
          {loadingPassword ? "Смена..." : "Сменить пароль"}
        </button>

        {passwordMessage && (
          <div className="password-message">{passwordMessage}</div>
        )}
      </div>
    </section>
  );
}
