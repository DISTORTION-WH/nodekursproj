import React, { useState } from "react";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileFriendList from "../components/profile/ProfileFriendList";
import ChangePasswordForm from "../components/profile/ChangePasswordForm";
import AvatarFrameShop from "../components/profile/AvatarFrameShop";
import { useAuth } from "../context/AuthContext";
import { updateUserStatus, updateUserTheme } from "../services/api";
import { UserStatus, AppTheme } from "../types";

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
  { value: "online", label: "В сети", color: "bg-discord-success" },
  { value: "away", label: "Отошёл", color: "bg-discord-warn" },
  { value: "dnd", label: "Не беспокоить", color: "bg-discord-danger" },
  { value: "offline", label: "Невидимый", color: "bg-discord-text-muted" },
];

const THEME_OPTIONS: { value: AppTheme; label: string; preview: string; secondary: string }[] = [
  { value: "dark", label: "Тёмная", preview: "#0b0e14", secondary: "#12161e" },
  { value: "gray", label: "Серая", preview: "#36393f", secondary: "#2f3136" },
  { value: "light", label: "Светлая", preview: "#f8f9fa", secondary: "#ffffff" },
];

export default function ProfilePage() {
  const { currentUser, handleAvatarChange, setCurrentUser } = useAuth();
  const [statusLoading, setStatusLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);

  const handleStatusChange = async (status: UserStatus) => {
    if (!currentUser || statusLoading) return;
    setStatusLoading(true);
    try {
      await updateUserStatus(status);
      setCurrentUser({ ...currentUser, status });
    } catch (err) {
      console.error(err);
      alert("Не удалось обновить статус");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleThemeChange = async (theme: AppTheme) => {
    if (!currentUser || themeLoading) return;
    setThemeLoading(true);
    const prevTheme = currentUser.theme || "dark";
    try {
      // Optimistic UI update
      setCurrentUser({ ...currentUser, theme });
      document.body.setAttribute("data-theme", theme);
      localStorage.setItem("app-theme", theme);
      await updateUserTheme(theme);
    } catch (err) {
      console.error(err);
      // Revert on failure
      setCurrentUser({ ...currentUser, theme: prevTheme });
      document.body.setAttribute("data-theme", prevTheme);
      localStorage.setItem("app-theme", prevTheme);
      alert("Не удалось сменить тему");
    } finally {
      setThemeLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-discord-bg p-3 sm:p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4 w-full min-w-0">
        <h2 className="text-discord-text-primary text-2xl font-bold">Мой профиль</h2>
        <ProfileHeader currentUser={currentUser} handleAvatarChange={handleAvatarChange} />

        {/* Status selector */}
        <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-discord-text-primary font-semibold text-sm">Статус</h3>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const active = (currentUser?.status || "offline") === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={statusLoading}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    active
                      ? "border-discord-accent bg-discord-accent/20 text-discord-text-primary"
                      : "border-discord-input bg-discord-tertiary text-discord-text-secondary hover:border-discord-accent/50"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme selector */}
        <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-discord-text-primary font-semibold text-sm">Тема оформления</h3>
          <div className="flex gap-3">
            {THEME_OPTIONS.map((opt) => {
              const active = (currentUser?.theme || localStorage.getItem("app-theme") || "dark") === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleThemeChange(opt.value)}
                  disabled={themeLoading}
                  title={opt.label}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition ${
                    active
                      ? "border-discord-accent"
                      : "border-discord-input hover:border-discord-accent/50"
                  }`}
                >
                  <div className="w-12 h-10 rounded-md overflow-hidden border border-white/10 flex">
                    <span className="flex-1" style={{ background: opt.preview }} />
                    <span className="flex-1" style={{ background: opt.secondary }} />
                  </div>
                  <span className="text-discord-text-secondary text-xs">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Avatar frame shop */}
        <AvatarFrameShop currentUser={currentUser} setCurrentUser={setCurrentUser} />

        <ProfileFriendList />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
