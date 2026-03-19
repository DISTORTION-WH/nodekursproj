import React, { useState } from "react";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileFriendList from "../components/profile/ProfileFriendList";
import ChangePasswordForm from "../components/profile/ChangePasswordForm";
import AvatarFrameShop from "../components/profile/AvatarFrameShop";
import { useAuth } from "../context/AuthContext";
import { updateUserStatus, updateUserTheme, updateUserBio, updateUserCountry } from "../services/api";
import { UserStatus, AppTheme } from "../types";
import { useI18n } from "../i18n";

const COUNTRIES: { code: string; flag: string; name_ru: string; name_en: string }[] = [
  { code: "", flag: "", name_ru: "Не указана", name_en: "Not specified" },
  { code: "RU", flag: "\u{1F1F7}\u{1F1FA}", name_ru: "Россия", name_en: "Russia" },
  { code: "US", flag: "\u{1F1FA}\u{1F1F8}", name_ru: "США", name_en: "USA" },
  { code: "GB", flag: "\u{1F1EC}\u{1F1E7}", name_ru: "Великобритания", name_en: "UK" },
  { code: "DE", flag: "\u{1F1E9}\u{1F1EA}", name_ru: "Германия", name_en: "Germany" },
  { code: "FR", flag: "\u{1F1EB}\u{1F1F7}", name_ru: "Франция", name_en: "France" },
  { code: "UA", flag: "\u{1F1FA}\u{1F1E6}", name_ru: "Украина", name_en: "Ukraine" },
  { code: "KZ", flag: "\u{1F1F0}\u{1F1FF}", name_ru: "Казахстан", name_en: "Kazakhstan" },
  { code: "BY", flag: "\u{1F1E7}\u{1F1FE}", name_ru: "Беларусь", name_en: "Belarus" },
  { code: "JP", flag: "\u{1F1EF}\u{1F1F5}", name_ru: "Япония", name_en: "Japan" },
  { code: "CN", flag: "\u{1F1E8}\u{1F1F3}", name_ru: "Китай", name_en: "China" },
  { code: "KR", flag: "\u{1F1F0}\u{1F1F7}", name_ru: "Южная Корея", name_en: "South Korea" },
  { code: "BR", flag: "\u{1F1E7}\u{1F1F7}", name_ru: "Бразилия", name_en: "Brazil" },
  { code: "IN", flag: "\u{1F1EE}\u{1F1F3}", name_ru: "Индия", name_en: "India" },
  { code: "TR", flag: "\u{1F1F9}\u{1F1F7}", name_ru: "Турция", name_en: "Turkey" },
  { code: "IT", flag: "\u{1F1EE}\u{1F1F9}", name_ru: "Италия", name_en: "Italy" },
  { code: "ES", flag: "\u{1F1EA}\u{1F1F8}", name_ru: "Испания", name_en: "Spain" },
  { code: "PL", flag: "\u{1F1F5}\u{1F1F1}", name_ru: "Польша", name_en: "Poland" },
  { code: "CA", flag: "\u{1F1E8}\u{1F1E6}", name_ru: "Канада", name_en: "Canada" },
  { code: "AU", flag: "\u{1F1E6}\u{1F1FA}", name_ru: "Австралия", name_en: "Australia" },
];

export default function ProfilePage() {
  const { currentUser, handleAvatarChange, setCurrentUser } = useAuth();
  const { t, lang } = useI18n();
  const [statusLoading, setStatusLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);
  const [bioEditing, setBioEditing] = useState(false);
  const [bioText, setBioText] = useState(currentUser?.bio ?? "");
  const [bioSaving, setBioSaving] = useState(false);
  const [countrySaving, setCountrySaving] = useState(false);

  const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
    { value: "online", label: t.profile.online, color: "bg-discord-success" },
    { value: "away", label: t.profile.away, color: "bg-discord-warn" },
    { value: "dnd", label: t.profile.dnd, color: "bg-discord-danger" },
    { value: "offline", label: t.profile.invisible, color: "bg-discord-text-muted" },
  ];

  const THEME_OPTIONS: { value: AppTheme; label: string; preview: string; secondary: string }[] = [
    { value: "dark", label: t.profile.dark, preview: "#0b0e14", secondary: "#12161e" },
    { value: "gray", label: t.profile.gray, preview: "#36393f", secondary: "#2f3136" },
    { value: "light", label: t.profile.light, preview: "#f8f9fa", secondary: "#ffffff" },
  ];

  const handleStatusChange = async (status: UserStatus) => {
    if (!currentUser || statusLoading) return;
    setStatusLoading(true);
    try {
      await updateUserStatus(status);
      setCurrentUser({ ...currentUser, status });
    } catch { /* */ } finally {
      setStatusLoading(false);
    }
  };

  const handleThemeChange = async (theme: AppTheme) => {
    if (!currentUser || themeLoading) return;
    setThemeLoading(true);
    const prevTheme = currentUser.theme || "dark";
    try {
      setCurrentUser({ ...currentUser, theme });
      document.body.setAttribute("data-theme", theme);
      localStorage.setItem("app-theme", theme);
      await updateUserTheme(theme);
    } catch {
      setCurrentUser({ ...currentUser, theme: prevTheme });
      document.body.setAttribute("data-theme", prevTheme);
      localStorage.setItem("app-theme", prevTheme);
    } finally {
      setThemeLoading(false);
    }
  };

  const handleBioSave = async () => {
    if (!currentUser || bioSaving) return;
    setBioSaving(true);
    try {
      await updateUserBio(bioText);
      setCurrentUser({ ...currentUser, bio: bioText });
      setBioEditing(false);
    } catch { /* */ } finally {
      setBioSaving(false);
    }
  };

  const handleCountryChange = async (country: string) => {
    if (!currentUser || countrySaving) return;
    setCountrySaving(true);
    try {
      await updateUserCountry(country);
      setCurrentUser({ ...currentUser, country });
    } catch { /* */ } finally {
      setCountrySaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-discord-bg p-3 sm:p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4 w-full min-w-0">
        <h2 className="text-discord-text-primary text-2xl font-bold">{t.profile.my_profile}</h2>
        <ProfileHeader currentUser={currentUser} handleAvatarChange={handleAvatarChange} />

        {/* Bio */}
        <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.bio}</h3>
            {!bioEditing && (
              <button
                onClick={() => { setBioText(currentUser?.bio ?? ""); setBioEditing(true); }}
                className="text-discord-accent text-xs hover:underline"
              >
                {currentUser?.bio ? "✏️" : "+"}
              </button>
            )}
          </div>
          {bioEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value.slice(0, 200))}
                placeholder={t.profile.bio_placeholder}
                maxLength={200}
                rows={3}
                className="w-full bg-discord-input text-discord-text-primary text-sm rounded-lg px-3 py-2 outline-none resize-none border border-discord-tertiary focus:border-discord-accent transition"
              />
              <div className="flex items-center justify-between">
                <span className="text-discord-text-muted text-xs">{bioText.length}/200</span>
                <div className="flex gap-2">
                  <button onClick={() => setBioEditing(false)} className="text-discord-text-muted text-xs hover:text-discord-text-primary">{t.common.cancel}</button>
                  <button onClick={handleBioSave} disabled={bioSaving} className="text-discord-accent text-xs font-semibold hover:underline">{t.common.save}</button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-discord-text-secondary text-sm">
              {currentUser?.bio || <span className="text-discord-text-muted italic">{t.profile.bio_placeholder}</span>}
            </p>
          )}
        </div>

        {/* Country */}
        <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.country}</h3>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map((c) => {
              const active = (currentUser?.country || "") === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => handleCountryChange(c.code)}
                  disabled={countrySaving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    active
                      ? "border-discord-accent bg-discord-accent/20 text-discord-text-primary"
                      : "border-discord-input bg-discord-tertiary text-discord-text-secondary hover:border-discord-accent/50"
                  }`}
                >
                  {c.flag && <span>{c.flag}</span>}
                  <span>{lang === "ru" ? c.name_ru : c.name_en}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status selector */}
        <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.status}</h3>
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
          <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.theme}</h3>
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
