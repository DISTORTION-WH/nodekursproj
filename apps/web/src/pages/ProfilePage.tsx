import React, { useState, useRef, useCallback, useEffect } from "react";
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
  resetProfile,
} from "../services/api";
import { UserStatus, AppTheme } from "../types";
import { useI18n } from "../i18n";
import { getImageUrl } from "../utils/imageUrl";

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Image Crop Tool ──────────────────────────────────────────────────────────

interface CropState { x: number; y: number; w: number; h: number }

function ImageCropper({
  src,
  naturalW,
  naturalH,
  onApply,
  onCancel,
}: {
  src: string;
  naturalW: number;
  naturalH: number;
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const DISPLAY_H = 200;
  const scale = DISPLAY_H / naturalH;
  const displayW = naturalW * scale;

  // Crop box in display coords (clamped to image bounds)
  const targetRatio = 3; // 3:1 banner
  const initH = DISPLAY_H;
  const initW = Math.min(displayW, initH * targetRatio);
  const [crop, setCrop] = useState<CropState>({
    x: (displayW - initW) / 2,
    y: 0,
    w: initW,
    h: initH,
  });

  const dragging = useRef<{ startX: number; startY: number; startCrop: CropState } | null>(null);
  const resizing = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const onMouseDown = (e: React.MouseEvent, handle?: string) => {
    e.preventDefault();
    if (handle) {
      resizing.current = handle;
    } else {
      dragging.current = { startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
    }
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (dragging.current) {
      const dx = e.clientX - dragging.current.startX;
      const dy = e.clientY - dragging.current.startY;
      const sc = dragging.current.startCrop;
      setCrop(prev => ({
        ...prev,
        x: clamp(sc.x + dx, 0, displayW - sc.w),
        y: clamp(sc.y + dy, 0, DISPLAY_H - sc.h),
      }));
    }
    if (resizing.current) {
      // fixed aspect ratio 3:1 resize from bottom-right
      setCrop(prev => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return prev;
        const mx = e.clientX - rect.left;
        const newW = clamp(mx - prev.x, 60, displayW - prev.x);
        const newH = newW / 3;
        return { ...prev, w: newW, h: clamp(newH, 20, DISPLAY_H - prev.y) };
      });
    }
  }, [displayW]);

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    resizing.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const applyCrop = () => {
    const canvas = document.createElement("canvas");
    // output 1500x500
    canvas.width = 1500;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      // crop in natural coords
      const sx = (crop.x / displayW) * naturalW;
      const sy = (crop.y / DISPLAY_H) * naturalH;
      const sw = (crop.w / displayW) * naturalW;
      const sh = (crop.h / DISPLAY_H) * naturalH;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1500, 500);
      onApply(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.src = src;
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-discord-text-secondary text-xs">{t.profile.bg_crop_title}</p>
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-lg"
        style={{ width: displayW, height: DISPLAY_H, maxWidth: "100%" }}
      >
        <img src={src} alt="crop" style={{ width: displayW, height: DISPLAY_H, display: "block" }} draggable={false} />
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)", pointerEvents: "none" }} />
        {/* Crop window */}
        <div
          className="absolute border-2 border-white cursor-move"
          style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h, boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }}
          onMouseDown={(e) => onMouseDown(e)}
        >
          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 bg-white cursor-se-resize"
            onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "se"); }}
          />
          {/* Rule of thirds grid */}
          {[1, 2].map(i => (
            <React.Fragment key={i}>
              <div className="absolute top-0 bottom-0" style={{ left: `${(i / 3) * 100}%`, width: 1, background: "rgba(255,255,255,0.4)" }} />
              <div className="absolute left-0 right-0" style={{ top: `${(i / 3) * 100}%`, height: 1, background: "rgba(255,255,255,0.4)" }} />
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={applyCrop}
          className="bg-discord-accent hover:bg-discord-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded transition"
        >
          {t.profile.bg_crop_apply}
        </button>
        <button
          onClick={onCancel}
          className="text-discord-text-muted text-xs hover:text-discord-text-primary px-3 py-1.5"
        >
          {t.profile.bg_crop_cancel}
        </button>
      </div>
    </div>
  );
}

// ─── RGB Gradient Picker ──────────────────────────────────────────────────────

type BgMode = "gradient" | "solid" | "image";

function GradientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (css: string) => void;
}) {
  const { t } = useI18n();

  // Parse existing gradient if possible, or start fresh
  const parseGrad = (v: string) => {
    const m = v.match(/linear-gradient\((\d+)deg,\s*(#[0-9a-fA-F]{3,8}),\s*(#[0-9a-fA-F]{3,8})\)/);
    if (m) return { angle: parseInt(m[1]), c1: m[2], c2: m[3] };
    return { angle: 135, c1: "#5865f2", c2: "#eb459e" };
  };

  const parsed = parseGrad(value);
  const [angle, setAngle] = useState(parsed.angle);
  const [c1, setC1] = useState(parsed.c1);
  const [c2, setC2] = useState(parsed.c2);

  const emit = (a: number, col1: string, col2: string) =>
    onChange(`linear-gradient(${a}deg,${col1},${col2})`);

  const PRESETS = [
    { c1: "#5865f2", c2: "#eb459e", a: 135 },
    { c1: "#f97316", c2: "#facc15", a: 135 },
    { c1: "#22c55e", c2: "#3b82f6", a: 135 },
    { c1: "#8b5cf6", c2: "#06b6d4", a: 135 },
    { c1: "#1a1a2e", c2: "#0f3460", a: 135 },
    { c1: "#ff6b6b", c2: "#feca57", a: 90 },
    { c1: "#43e97b", c2: "#38f9d7", a: 135 },
    { c1: "#f093fb", c2: "#f5576c", a: 135 },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Preset swatches */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={() => { setC1(p.c1); setC2(p.c2); setAngle(p.a); emit(p.a, p.c1, p.c2); }}
            className="w-8 h-8 rounded-full border-2 border-white/20 hover:border-white transition shrink-0"
            style={{ background: `linear-gradient(${p.a}deg,${p.c1},${p.c2})` }}
          />
        ))}
      </div>

      {/* Color pickers */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1 items-center">
          <label className="text-discord-text-muted text-xs">{t.profile.bg_color1}</label>
          <input
            type="color"
            value={c1}
            onChange={(e) => { setC1(e.target.value); emit(angle, e.target.value, c2); }}
            className="w-10 h-10 rounded cursor-pointer border-2 border-discord-input"
          />
          <span className="text-discord-text-muted text-[10px]">{c1}</span>
        </div>

        {/* Angle slider */}
        <div className="flex flex-col gap-1 flex-1 items-center">
          <label className="text-discord-text-muted text-xs">{t.profile.bg_angle}: {angle}°</label>
          <input
            type="range"
            min={0}
            max={360}
            value={angle}
            onChange={(e) => { const a = parseInt(e.target.value); setAngle(a); emit(a, c1, c2); }}
            className="w-full accent-discord-accent"
          />
          {/* Angle wheel preview */}
          <div
            className="w-8 h-8 rounded-full border-2 border-discord-accent"
            style={{ background: `conic-gradient(from ${angle}deg, ${c1}, ${c2}, ${c1})` }}
          />
        </div>

        <div className="flex flex-col gap-1 items-center">
          <label className="text-discord-text-muted text-xs">{t.profile.bg_color2}</label>
          <input
            type="color"
            value={c2}
            onChange={(e) => { setC2(e.target.value); emit(angle, c1, e.target.value); }}
            className="w-10 h-10 rounded cursor-pointer border-2 border-discord-input"
          />
          <span className="text-discord-text-muted text-[10px]">{c2}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Solid Color Picker ───────────────────────────────────────────────────────

function SolidPicker({ value, onChange }: { value: string; onChange: (css: string) => void }) {
  const isGrad = /gradient/.test(value);
  const current = isGrad ? "#5865f2" : (value || "#5865f2");
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-12 rounded cursor-pointer border-2 border-discord-input"
      />
      <span className="text-discord-text-secondary text-sm font-mono">{current}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { currentUser, handleAvatarChange, setCurrentUser } = useAuth();
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<"view" | "settings">("view");

  // ── Status / Theme ──
  const [statusLoading, setStatusLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);

  // ── Bio ──
  const [bioEditing, setBioEditing] = useState(false);
  const [bioText, setBioText] = useState(currentUser?.bio ?? "");
  const [bioSaving, setBioSaving] = useState(false);

  // ── Country ──
  const [countrySaving, setCountrySaving] = useState(false);

  // ── Profile Background ──
  const [bgMode, setBgMode] = useState<BgMode>("gradient");
  const [bgValue, setBgValue] = useState(currentUser?.profile_bg ?? "");
  const [bgSaving, setBgSaving] = useState(false);
  const [bgSaved, setBgSaved] = useState(false);
  // Image crop
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropNatW, setCropNatW] = useState(0);
  const [cropNatH, setCropNatH] = useState(0);
  const [badRatio, setBadRatio] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // ── Username style ──
  const [uColor, setUColor] = useState(currentUser?.username_color ?? "");
  const [uAnim, setUAnim] = useState<string>(currentUser?.username_anim ?? "");
  const [styleSaving, setStyleSaving] = useState(false);
  const [styleSaved, setStyleSaved] = useState(false);

  // ── Extras ──
  const [extBadge, setExtBadge] = useState(currentUser?.profile_badge ?? "");
  const [extBubble, setExtBubble] = useState(currentUser?.bubble_color ?? "");
  const [extLink, setExtLink] = useState(currentUser?.social_link ?? "");
  const [extAccent, setExtAccent] = useState(currentUser?.accent_color ?? "");
  const [extrasSaving, setExtrasSaving] = useState(false);
  const [extrasSaved, setExtrasSaved] = useState(false);

  // ── Reset ──
  const [resetting, setResetting] = useState(false);

  // Detect gradient vs solid from saved value
  useEffect(() => {
    const bg = currentUser?.profile_bg ?? "";
    if (!bg) { setBgMode("gradient"); return; }
    if (/gradient/.test(bg)) setBgMode("gradient");
    else if (/^https?:\/\/|^data:/.test(bg)) setBgMode("image");
    else setBgMode("solid");
    setBgValue(bg);
  }, [currentUser?.profile_bg]);

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
      await updateProfileBg(bgValue);
      setCurrentUser({ ...currentUser, profile_bg: bgValue });
      setBgSaved(true);
      setTimeout(() => setBgSaved(false), 2000);
    } catch { /* */ } finally {
      setBgSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      setBadRatio(ratio < 2); // warn if narrower than 2:1
      setCropNatW(img.naturalWidth);
      setCropNatH(img.naturalHeight);
      setCropSrc(url);
    };
    img.src = url;
    // reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleCropApply = (dataUrl: string) => {
    setBgValue(dataUrl);
    setCropSrc(null);
    setBadRatio(false);
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

  const handleResetAll = async () => {
    if (!currentUser || resetting) return;
    if (!window.confirm(t.profile.reset_confirm)) return;
    setResetting(true);
    try {
      await resetProfile();
      const blank = {
        ...currentUser,
        profile_bg: "", username_color: "", username_anim: "",
        profile_badge: "", bubble_color: "", social_link: "", accent_color: "",
        bio: "", country: "",
      };
      setCurrentUser(blank);
      // Reset local state
      setBgValue(""); setUColor(""); setUAnim(""); setExtBadge("");
      setExtBubble(""); setExtLink(""); setExtAccent(""); setBioText("");
      alert(t.profile.reset_done);
    } catch { /* */ } finally {
      setResetting(false);
    }
  };

  const countryInfo = currentUser?.country
    ? COUNTRIES.find((c) => c.code === currentUser.country)
    : null;

  const BG_MODES: { id: BgMode; label: string }[] = [
    { id: "gradient", label: t.profile.bg_mode_gradient },
    { id: "solid", label: t.profile.bg_mode_solid },
    { id: "image", label: t.profile.bg_mode_image },
  ];

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-discord-bg p-3 sm:p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4 w-full min-w-0">
        <h2 className="text-discord-text-primary text-2xl font-bold">{t.profile.my_profile}</h2>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-discord-secondary rounded-lg p-1 w-fit">
          {(["view", "settings"] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === id
                  ? "bg-discord-accent text-white"
                  : "text-discord-text-secondary hover:text-discord-text-primary"
              }`}
            >
              {id === "view" ? t.profile.tab_view : t.profile.tab_settings}
            </button>
          ))}
        </div>

        {/* ── VIEW TAB ── */}
        {tab === "view" && (
          <>
            <div className="bg-discord-secondary rounded-xl overflow-hidden">
              <ProfileBackground profileBg={currentUser?.profile_bg} height={120} />
              <div className="relative px-6 pb-6">
                <div className="absolute -top-10 left-6">
                  <div className="ring-4 ring-discord-secondary rounded-full">
                    <AvatarWithFrame
                      src={getImageUrl(currentUser?.avatar_url)}
                      frame={currentUser?.avatar_frame}
                      size={80}
                    />
                  </div>
                </div>
                <div className="pt-12 flex flex-col min-w-0">
                  <UsernameDisplay
                    username={currentUser?.username ?? ""}
                    color={currentUser?.username_color}
                    anim={currentUser?.username_anim}
                    badge={currentUser?.profile_badge}
                    className="text-white text-xl font-bold"
                  />
                  <span className="text-discord-text-muted text-sm">{currentUser?.role || "USER"}</span>
                </div>
                <div className="mt-2">
                  {countryInfo?.code && (
                    <p className="text-discord-text-secondary text-sm mb-1">
                      {countryInfo.flag} {lang === "ru" ? countryInfo.name_ru : countryInfo.name_en}
                    </p>
                  )}
                  {currentUser?.bio && (
                    <p className="text-discord-text-secondary text-sm">{currentUser.bio}</p>
                  )}
                  {currentUser?.social_link && (
                    <a href={currentUser.social_link} target="_blank" rel="noopener noreferrer"
                      className="text-discord-accent text-sm hover:underline truncate mt-1 block">
                      🔗 {currentUser.social_link.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {currentUser?.bubble_color && (
                    <div className="mt-2 flex">
                      <span className="px-3 py-1.5 rounded-xl text-sm text-white"
                        style={{ background: currentUser.bubble_color }}>
                        {t.profile.bubble_preview}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
                  <button onClick={() => { setBioText(currentUser?.bio ?? ""); setBioEditing(true); }}
                    className="text-discord-accent text-xs hover:underline">
                    {currentUser?.bio ? "✏️" : "+"}
                  </button>
                )}
              </div>
              {bioEditing ? (
                <div className="flex flex-col gap-2">
                  <textarea value={bioText} onChange={(e) => setBioText(e.target.value.slice(0, 200))}
                    placeholder={t.profile.bio_placeholder} maxLength={200} rows={3}
                    className="w-full bg-discord-input text-discord-text-primary text-sm rounded-lg px-3 py-2 outline-none resize-none border border-discord-tertiary focus:border-discord-accent transition" />
                  <div className="flex items-center justify-between">
                    <span className="text-discord-text-muted text-xs">{bioText.length}/200</span>
                    <div className="flex gap-2">
                      <button onClick={() => setBioEditing(false)} className="text-discord-text-muted text-xs">{t.common.cancel}</button>
                      <button onClick={handleBioSave} disabled={bioSaving} className="text-discord-accent text-xs font-semibold">{t.common.save}</button>
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

              {/* Mode tabs */}
              <div className="flex gap-1 bg-discord-tertiary rounded-lg p-1 w-fit">
                {BG_MODES.map((m) => (
                  <button key={m.id} onClick={() => setBgMode(m.id)}
                    className={`px-3 py-1 rounded text-xs font-medium transition ${
                      bgMode === m.id ? "bg-discord-accent text-white" : "text-discord-text-secondary hover:text-discord-text-primary"
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Gradient picker */}
              {bgMode === "gradient" && (
                <GradientPicker value={bgValue} onChange={setBgValue} />
              )}

              {/* Solid color picker */}
              {bgMode === "solid" && (
                <SolidPicker value={bgValue} onChange={setBgValue} />
              )}

              {/* Image upload + crop */}
              {bgMode === "image" && (
                <div className="flex flex-col gap-3">
                  <p className="text-discord-text-muted text-xs">{t.profile.bg_image_hint}</p>
                  {badRatio && (
                    <p className="text-discord-warn text-xs">{t.profile.bg_image_bad_ratio}</p>
                  )}
                  <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <button
                    onClick={() => imgInputRef.current?.click()}
                    className="self-start bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary text-xs font-medium px-3 py-1.5 rounded transition border border-discord-tertiary"
                  >
                    {t.profile.bg_image_upload}
                  </button>
                  {cropSrc && (
                    <ImageCropper
                      src={cropSrc}
                      naturalW={cropNatW}
                      naturalH={cropNatH}
                      onApply={handleCropApply}
                      onCancel={() => { setCropSrc(null); setBadRatio(false); }}
                    />
                  )}
                </div>
              )}

              {/* Live preview */}
              <ProfileBackground profileBg={bgValue} height={56} className="rounded-lg" />

              <div className="flex items-center gap-3">
                <button onClick={handleBgSave} disabled={bgSaving}
                  className="bg-discord-accent hover:bg-discord-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded transition disabled:opacity-50">
                  {bgSaved ? t.profile.profile_bg_saved : t.profile.profile_bg_save}
                </button>
                <button onClick={() => setBgValue("")}
                  className="text-discord-text-muted text-xs hover:text-discord-text-primary">
                  {t.common.cancel}
                </button>
              </div>
            </div>

            {/* Username style */}
            <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
              <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.username_style}</h3>
              <div className="bg-discord-input rounded-lg px-4 py-2 flex items-center gap-3">
                <AvatarWithFrame src={getImageUrl(currentUser?.avatar_url)} frame={currentUser?.avatar_frame} size={32} />
                <UsernameDisplay
                  username={currentUser?.username ?? ""}
                  color={uColor || undefined}
                  anim={uAnim || undefined}
                  badge={extBadge || undefined}
                  className="text-sm font-semibold"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-discord-text-muted text-xs">{t.profile.username_color}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={uColor || "#ffffff"}
                    onChange={(e) => setUColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-2 border-discord-input" />
                  <input type="text" value={uColor} onChange={(e) => setUColor(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition" />
                  {uColor && (
                    <button onClick={() => setUColor("")} className="text-discord-text-muted text-xs hover:text-discord-text-primary">✕</button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-discord-text-muted text-xs">{t.profile.username_anim}</label>
                <div className="flex flex-wrap gap-2">
                  {ANIM_OPTIONS.map((a) => (
                    <button key={a} onClick={() => setUAnim(a)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                        uAnim === a
                          ? "border-discord-accent bg-discord-accent/20 text-discord-text-primary"
                          : "border-discord-input bg-discord-tertiary text-discord-text-secondary hover:border-discord-accent/50"
                      }`}>
                      {animLabel(a)}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleStyleSave} disabled={styleSaving}
                className="self-end bg-discord-accent hover:bg-discord-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded transition disabled:opacity-50">
                {styleSaved ? t.profile.style_saved : t.common.save}
              </button>
            </div>

            {/* Extras */}
            <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-4">
              <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.extras}</h3>

              {/* Badge */}
              <div className="flex flex-col gap-1.5">
                <label className="text-discord-text-muted text-xs">{t.profile.profile_badge}</label>
                <div className="flex items-center gap-3">
                  {extBadge && <span className="text-2xl leading-none">{extBadge}</span>}
                  <input type="text" value={extBadge}
                    onChange={(e) => setExtBadge(Array.from(e.target.value).slice(0, 2).join(""))}
                    placeholder={t.profile.profile_badge_placeholder}
                    className="flex-1 bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition" />
                </div>
              </div>

              {/* Bubble color */}
              <div className="flex flex-col gap-1.5">
                <label className="text-discord-text-muted text-xs">{t.profile.bubble_color}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={extBubble || "#5865f2"}
                    onChange={(e) => setExtBubble(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-2 border-discord-input shrink-0" />
                  <input type="text" value={extBubble} onChange={(e) => setExtBubble(e.target.value)}
                    placeholder="#5865f2"
                    className="flex-1 bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition" />
                  {extBubble && <button onClick={() => setExtBubble("")} className="text-discord-text-muted text-xs">✕</button>}
                </div>
                {extBubble && (
                  <span className="self-start px-3 py-1.5 rounded-xl text-sm text-white mt-1"
                    style={{ background: extBubble }}>
                    {t.profile.bubble_preview}
                  </span>
                )}
              </div>

              {/* Social link */}
              <div className="flex flex-col gap-1.5">
                <label className="text-discord-text-muted text-xs">{t.profile.social_link}</label>
                <input type="url" value={extLink} onChange={(e) => setExtLink(e.target.value)}
                  placeholder={t.profile.social_link_placeholder}
                  className="bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition" />
              </div>

              {/* Accent color */}
              <div className="flex flex-col gap-1.5">
                <label className="text-discord-text-muted text-xs">{t.profile.accent_color}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={extAccent || "#5865f2"}
                    onChange={(e) => setExtAccent(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-2 border-discord-input shrink-0" />
                  <input type="text" value={extAccent} onChange={(e) => setExtAccent(e.target.value)}
                    placeholder="#5865f2"
                    className="flex-1 bg-discord-input text-discord-text-primary text-sm rounded px-2 py-1 outline-none border border-discord-tertiary focus:border-discord-accent transition" />
                  <button style={extAccent ? { background: extAccent } : undefined}
                    className="text-white text-xs font-semibold px-3 py-1.5 rounded bg-discord-accent shrink-0">
                    {t.profile.tab_view}
                  </button>
                  {extAccent && <button onClick={() => setExtAccent("")} className="text-discord-text-muted text-xs">✕</button>}
                </div>
              </div>

              <button onClick={handleExtrasSave} disabled={extrasSaving}
                className="self-end bg-discord-accent hover:bg-discord-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded transition disabled:opacity-50">
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
                    <button key={c.code} onClick={() => handleCountryChange(c.code)} disabled={countrySaving}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                        active
                          ? "border-discord-accent bg-discord-accent/20 text-discord-text-primary"
                          : "border-discord-input bg-discord-tertiary text-discord-text-secondary hover:border-discord-accent/50"
                      }`}>
                      {c.flag && <span>{c.flag}</span>}
                      <span>{lang === "ru" ? c.name_ru : c.name_en}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
              <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.status}</h3>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const active = (currentUser?.status || "offline") === opt.value;
                  return (
                    <button key={opt.value} onClick={() => handleStatusChange(opt.value)} disabled={statusLoading}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                        active
                          ? "border-discord-accent bg-discord-accent/20 text-discord-text-primary"
                          : "border-discord-input bg-discord-tertiary text-discord-text-secondary hover:border-discord-accent/50"
                      }`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme */}
            <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
              <h3 className="text-discord-text-primary font-semibold text-sm">{t.profile.theme}</h3>
              <div className="flex gap-3">
                {THEME_OPTIONS.map((opt) => {
                  const active = (currentUser?.theme || localStorage.getItem("app-theme") || "dark") === opt.value;
                  return (
                    <button key={opt.value} onClick={() => handleThemeChange(opt.value)} disabled={themeLoading} title={opt.label}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition ${
                        active ? "border-discord-accent" : "border-discord-input hover:border-discord-accent/50"
                      }`}>
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

            {/* Reset all */}
            <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-2">
              <h3 className="text-discord-danger font-semibold text-sm">{t.profile.reset_all}</h3>
              <p className="text-discord-text-muted text-xs">{t.profile.reset_confirm}</p>
              <button
                onClick={handleResetAll}
                disabled={resetting}
                className="self-start bg-discord-danger/20 hover:bg-discord-danger text-discord-danger hover:text-white text-xs font-semibold px-4 py-2 rounded transition border border-discord-danger/40 disabled:opacity-50"
              >
                {resetting ? "..." : t.profile.reset_all}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
