import React, { useState } from "react";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileFriendList from "../components/profile/ProfileFriendList";
import ChangePasswordForm from "../components/profile/ChangePasswordForm";
import AvatarFrameShop from "../components/profile/AvatarFrameShop";
import ProfileBackground from "../components/profile/ProfileBackground";
import UsernameDisplay from "../components/profile/UsernameDisplay";
import { AvatarWithFrame } from "../components/profile/AvatarFrameShop";
import { useAuth } from "../context/AuthContext";
import {
  updateUserStatus,
  updateUserTheme,
  updateUserBio,
  updateUserCountry,
  updateProfileBg,
  updateUsernameStyle,
  updateProfileExtras,
} from "../services/api";
import { UserStatus, AppTheme } from "../types";
import { useI18n } from "../i18n";
import { getImageUrl } from "../utils/imageUrl";

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

const ANIM_OPTIONS = ["", "rainbow", "pulse", "glitch", "shimmer", "fire"] as const;

export default function ProfilePage() {
  const { currentUser, handleAvatarChange, setCurrentUser } = useAuth();
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<"view" | "settings">("view");

  // Settings state
  const [statusLoading, setStatusLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);
  const [bioEditing, setBioEditing] = useState(false);
  const [bioText, setBioText] = useState(currentUser?.bio ?? "");
  const [bioSaving, setBioSaving] = useState(false);
  const [countrySaving, setCountrySaving] = useState(false);

  // Profile bg
  const [bgText, setBgText] = useState(currentUser?.profile_bg ?? "");
  const [bgSaving, setBgSaving] = useState(false);
  const [bgSaved, setBgSaved] = useState(false);

  // Username style
  const [uColor, setUColor] = useState(currentUser?.username_color ?? "");
  const [uAnim, setUAnim] = useState<string>(currentUser?.username_anim ?? "");
  const [styleSaving, setStyleSaving] = useState(false);
  const [styleSaved, setStyleSaved] = useState(false);

  // Extras
  const [extBadge, setExtBadge] = useState(currentUser?.profile_badge ?? "");
  const [extBubble, setExtBubble] = useState(currentUser?.bubble_color ?? "");
  const [extLink, setExtLink] = useState(currentUser?.social_link ?? "");
  const [extAccent, setExtAccent] = useState(currentUser?.accent_color ?? "");
  const [extrasSaving, setExtrasSaving] = useState(false);
  const [extrasSaved, setExtrasSaved] = useState(false);

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

  const animLabel = (a: string) => {
    const map: Record<string, string> = {
      "": t.profile.anim_none,
      rainbow: t.profile.anim_rainbow,
      pulse: t.profile.anim_pulse,
      glitch: t.profile.anim_glitch,
      shimmer: t.profile.anim_shimmer,
      fire: t.profile.anim_fire,
    };
    return map[a] ?? a;
  };

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

  const handleBgSave = async () => {
    if (!currentUser || bgSaving) return;
    setBgSaving(true);
    try {
      await updateProfileBg(bgText);
      setCurrentUser({ ...currentUser, profile_bg: bgText });
      setBgSaved(true);
      setTimeout(() => setBgSaved(false), 2000);
    } catch { /* */ } finally {
      setBgSaving(false);
    }
  };

  const handleStyleSave = async () => {
    if (!currentUser || styleSaving) return;
    setStyleSaving(true);
    try {
      await updateUsernameStyle(uColor, uAnim);
      setCurrentUser({ ...currentUser, username_color: uColor, username_anim: uAnim });
      setStyleSaved(true);
      setTimeout(() => setStyleSaved(false), 2000);
    } catch { /* */ } finally {
      setStyleSaving(false);
    }
  };

  const handleExtrasSave = async () => {
    if (!currentUser || extrasSaving) return;
    setExtrasSaving(true);
    try {
      await updateProfileExtras(extBadge, extBubble, extLink, extAccent);
      setCurrentUser({
        ...currentUser,
        profile_badge: extBadge,
        bubble_color: extBubble,
        social_link: extLink,
        accent_color: extAccent,
      });
      setExtrasSaved(true);
      setTimeout(() => setExtrasSaved(false), 2000);
    } catch { /* */ } finally {
      setExtrasSaving(false);
    }
  };

  const countryInfo = currentUser?.country
    ? COUNTRIES.find((c) => c.code === currentUser.country)
    : null;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-discord-bg p-3 sm:p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4 w-full min-w-0">
        <h2 className="text-discord-text-primary text-2xl font-bold">{t.profile.my_profile}</h2>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-discord-secondary rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("view")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === "view"
                ? "bg-discord-accent text-white"
                : "text-discord-text-secondary hover:text-discord-text-primary"
            }`}
          >
            {t.profile.tab_view}
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === "settings"
                ? "bg-discord-accent text-white"
                : "text-discord-text-secondary hover:text-discord-text-primary"
            }`}
          >
            {t.profile.tab_settings}
          </button>
        </div>

        {/* ── VIEW TAB ── */}
        {tab === "view" && (
          <>
            {/* Profile card preview */}
            <div className="bg-discord-secondary rounded-xl">
              <ProfileBackground profileBg={currentUser?.profile_bg} height={120} />
              <div className="px-6 pb-6">
                <div className="flex items-end gap-4 -mt-10 mb-3">
                  <div className="ring-4 ring-discord-secondary rounded-full shrink-0">
                    <AvatarWithFrame
                      src={getImageUrl(currentUser?.avatar_url)}
                      frame={currentUser?.avatar_frame}
                      size={80}
                    />
                  </div>
                  <div className="pb-1 flex flex-col min-w-0">
                    <UsernameDisplay
                      username={currentUser?.username ?? ""}
                      color={currentUser?.username_color}
                      anim={currentUser?.username_anim}
                      badge={currentUser?.profile_badge}
                      className="text-white text-xl font-bold truncate"
                    />
                    <span className="text-discord-text-muted text-sm">{currentUser?.role || "USER"}</span>
                  </div>
                </div>
                {countryInfo && countryInfo.code && (
                  <p className="text-discord-text-secondary text-sm mb-2">
                    {countryInfo.flag} {lang === "ru" ? countryInfo.name_ru : countryInfo.name_en}
                  </p>
                )}
                {currentUser?.bio && (
                  <p className="text-discord-text-secondary text-sm">{currentUser.bio}</p>
                )}
                {currentUser?.social_link && (
                  <a
                    href={currentUser.social_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-discord-accent text-sm hover:underline truncate mt-1 block"
                  >
                    🔗 {currentUser.social_link.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {/* Bubble color preview */}
                {currentUser?.bubble_color && (
                  <div className="mt-2 flex items-start">
                    <span
                      className="px-3 py-1.5 rounded-xl text-sm text-white"
                      style={{ background: currentUser.bubble_color }}
                    >
                      {t.profile.bubble_preview}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Friends */}
            <ProfileFriendList />
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && (
          <>
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

            {/* Profile background */}
            <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
              <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.profile_bg}</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={bgText}
                  onChange={(e) => setBgText(e.target.value)}
                  placeholder={t.profile.profile_bg_placeholder}
                  className="w-full bg-discord-input text-discord-text-primary text-sm rounded-lg px-3 py-2 outline-none border border-discord-tertiary focus:border-discord-accent transition"
                />
                {/* Live preview strip */}
                <ProfileBackground profileBg={bgText || currentUser?.profile_bg} height={48} className="rounded-lg" />
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Preset gradients */}
                  {[
                    "linear-gradient(135deg,#5865f2,#eb459e)",
                    "linear-gradient(135deg,#f97316,#facc15)",
                    "linear-gradient(135deg,#22c55e,#3b82f6)",
                    "linear-gradient(135deg,#8b5cf6,#06b6d4)",
                    "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)",
                  ].map((g) => (
                    <button
                      key={g}
                      onClick={() => setBgText(g)}
                      title={g}
                      className="w-8 h-8 rounded-full border-2 border-white/20 hover:border-discord-accent transition shrink-0"
                      style={{ background: g }}
                    />
                  ))}
                  <button
                    onClick={() => setBgText("")}
                    className="text-discord-text-muted text-xs hover:text-discord-text-primary"
                  >
                    {t.common.cancel}
                  </button>
                </div>
                <button
                  onClick={handleBgSave}
                  disabled={bgSaving}
                  className="self-end bg-discord-accent hover:bg-discord-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded transition disabled:opacity-50"
                >
                  {bgSaved ? t.profile.profile_bg_saved : t.profile.profile_bg_save}
                </button>
              </div>
            </div>

            {/* Username style */}
            <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
              <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.username_style}</h3>

              {/* Live preview */}
              <div className="bg-discord-input rounded-lg px-4 py-2 flex items-center gap-3">
                <AvatarWithFrame src={getImageUrl(currentUser?.avatar_url)} frame={currentUser?.avatar_frame} size={32} />
                <UsernameDisplay
                  username={currentUser?.username ?? ""}
                  color={uColor || undefined}
                  anim={uAnim || undefined}
                  className="text-sm font-semibold"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-discord-text-muted text-xs">{t.profile.username_color}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={uColor || "#ffffff"}
                    onChange={(e) => setUColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={uColor}
                    onChange={(e) => setUColor(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition"
                  />
                  {uColor && (
                    <button
                      onClick={() => setUColor("")}
                      className="text-discord-text-muted text-xs hover:text-discord-text-primary"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-discord-text-muted text-xs">{t.profile.username_anim}</label>
                <div className="flex flex-wrap gap-2">
                  {ANIM_OPTIONS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setUAnim(a)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                        uAnim === a
                          ? "border-discord-accent bg-discord-accent/20 text-discord-text-primary"
                          : "border-discord-input bg-discord-tertiary text-discord-text-secondary hover:border-discord-accent/50"
                      }`}
                    >
                      {animLabel(a)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStyleSave}
                disabled={styleSaving}
                className="self-end bg-discord-accent hover:bg-discord-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded transition disabled:opacity-50"
              >
                {styleSaved ? t.profile.style_saved : t.common.save}
              </button>
            </div>

            {/* Extras: badge, bubble color, social link, accent color */}
            <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-4">
              <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.extras}</h3>

              {/* Badge */}
              <div className="flex flex-col gap-1.5">
                <label className="text-discord-text-muted text-xs">{t.profile.profile_badge}</label>
                <div className="flex items-center gap-3">
                  {extBadge && <span className="text-2xl leading-none">{extBadge}</span>}
                  <input
                    type="text"
                    value={extBadge}
                    onChange={(e) => setExtBadge(Array.from(e.target.value).slice(0, 2).join(""))}
                    placeholder={t.profile.profile_badge_placeholder}
                    className="flex-1 bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition"
                  />
                </div>
              </div>

              {/* Bubble color */}
              <div className="flex flex-col gap-1.5">
                <label className="text-discord-text-muted text-xs">{t.profile.bubble_color}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={extBubble || "#5865f2"}
                    onChange={(e) => setExtBubble(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent shrink-0"
                  />
                  <input
                    type="text"
                    value={extBubble}
                    onChange={(e) => setExtBubble(e.target.value)}
                    placeholder="#5865f2 or linear-gradient(...)"
                    className="flex-1 bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition"
                  />
                  {extBubble && (
                    <button onClick={() => setExtBubble("")} className="text-discord-text-muted text-xs hover:text-discord-text-primary">✕</button>
                  )}
                </div>
                {/* preview */}
                {extBubble && (
                  <span
                    className="self-start px-3 py-1.5 rounded-xl text-sm text-white mt-1"
                    style={{ background: extBubble }}
                  >
                    {t.profile.bubble_preview}
                  </span>
                )}
              </div>

              {/* Social link */}
              <div className="flex flex-col gap-1.5">
                <label className="text-discord-text-muted text-xs">{t.profile.social_link}</label>
                <input
                  type="url"
                  value={extLink}
                  onChange={(e) => setExtLink(e.target.value)}
                  placeholder={t.profile.social_link_placeholder}
                  className="bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition"
                />
              </div>

              {/* Accent color */}
              <div className="flex flex-col gap-1.5">
                <label className="text-discord-text-muted text-xs">{t.profile.accent_color}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={extAccent || "#5865f2"}
                    onChange={(e) => setExtAccent(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent shrink-0"
                  />
                  <input
                    type="text"
                    value={extAccent}
                    onChange={(e) => setExtAccent(e.target.value)}
                    placeholder="#5865f2"
                    className="flex-1 bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition"
                  />
                  {/* preview button */}
                  <button
                    style={extAccent ? { background: extAccent } : undefined}
                    className="text-white text-xs font-semibold px-3 py-1.5 rounded bg-discord-accent shrink-0"
                  >
                    {t.profile.tab_view}
                  </button>
                  {extAccent && (
                    <button onClick={() => setExtAccent("")} className="text-discord-text-muted text-xs hover:text-discord-text-primary">✕</button>
                  )}
                </div>
              </div>

              <button
                onClick={handleExtrasSave}
                disabled={extrasSaving}
                className="self-end bg-discord-accent hover:bg-discord-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded transition disabled:opacity-50"
              >
                {extrasSaved ? t.profile.extras_saved : t.common.save}
              </button>
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

            <ChangePasswordForm />
          </>
        )}
      </div>
    </div>
  );
}
