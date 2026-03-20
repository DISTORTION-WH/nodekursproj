import React, { useState } from "react";
import api from "../../services/api";
import { useI18n } from "../../i18n";

export default function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { t } = useI18n();

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMessage(t.profile.fill_all_fields);
      setIsSuccess(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage(t.profile.passwords_mismatch);
      setIsSuccess(false);
      return;
    }
    setPasswordMessage("");
    setLoadingPassword(true);
    try {
      await api.put("/users/password", { oldPassword, newPassword });
      setPasswordMessage(t.profile.password_changed);
      setIsSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage(err.response?.data?.message || t.common.error);
      setIsSuccess(false);
    } finally {
      setLoadingPassword(false);
    }
  };

  const inputClass =
    "bg-discord-input text-discord-text-primary rounded px-3 py-2 outline-none focus:ring-2 focus:ring-discord-accent placeholder-discord-text-muted w-full text-sm";

  return (
    <div className="bg-discord-secondary rounded-xl p-6">
      <h3 className="text-discord-text-primary font-semibold text-base mb-3">{t.profile.change_password}</h3>
      <div className="flex flex-col gap-3 max-w-sm">
        <input
          type="password"
          placeholder={t.profile.old_password}
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder={t.profile.new_password}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder={t.profile.confirm_password}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
        <button
          onClick={handleChangePassword}
          disabled={loadingPassword}
          className="bg-discord-accent hover:bg-discord-accent-hover text-white text-sm font-semibold py-2 rounded transition disabled:opacity-50 w-fit px-4"
        >
          {loadingPassword ? t.profile.changing_password : t.profile.change_password}
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
