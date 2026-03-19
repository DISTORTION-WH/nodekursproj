import React, { useState } from "react";
import { User } from "../../types";
import { getImageUrl } from "../../utils/imageUrl";
import { updateUserAvatarFrame } from "../../services/api";

export interface AvatarFrame {
  id: string;
  label: string;
  description: string;
  style: React.CSSProperties;
  className?: string;
  /** Keyframes to inject via <style> */
  keyframes?: string;
}

export const AVATAR_FRAMES: AvatarFrame[] = [
  {
    id: "none",
    label: "Без рамки",
    description: "Стандартный вид",
    style: { border: "4px solid transparent" },
  },
  {
    id: "accent",
    label: "Акцент",
    description: "Простая фиолетовая рамка",
    style: { border: "4px solid #5865f2", boxShadow: "0 0 0 2px rgba(88,101,242,0.3)" },
  },
  {
    id: "gold",
    label: "Золотая",
    description: "Классическая золотая рамка",
    style: { border: "4px solid #f1c40f", boxShadow: "0 0 0 2px rgba(241,196,15,0.3)" },
  },
  {
    id: "rose",
    label: "Розовая",
    description: "Нежная розовая рамка",
    style: { border: "4px solid #eb459e", boxShadow: "0 0 0 2px rgba(235,69,158,0.3)" },
  },
  {
    id: "cyan",
    label: "Неон",
    description: "Ярко-бирюзовая рамка",
    style: { border: "4px solid #00d4ff", boxShadow: "0 0 8px rgba(0,212,255,0.6), 0 0 0 2px rgba(0,212,255,0.2)" },
  },
  {
    id: "fire",
    label: "Огонь",
    description: "Пульсирующая красная рамка",
    keyframes: `@keyframes fire-pulse { 0%,100%{box-shadow:0 0 6px 2px rgba(237,66,69,0.7),0 0 0 2px rgba(237,66,69,0.3)} 50%{box-shadow:0 0 18px 4px rgba(255,120,0,0.9),0 0 0 2px rgba(237,66,69,0.5)} }`,
    style: { border: "4px solid #ed4245", animation: "fire-pulse 1.5s ease-in-out infinite" },
  },
  {
    id: "rainbow",
    label: "Радуга",
    description: "Переливающаяся рамка",
    keyframes: `@keyframes rainbow-spin { 0%{border-color:#ff6b6b} 16%{border-color:#feca57} 33%{border-color:#48dbfb} 50%{border-color:#ff9ff3} 66%{border-color:#54a0ff} 83%{border-color:#5f27cd} 100%{border-color:#ff6b6b} }`,
    style: { border: "4px solid #ff6b6b", animation: "rainbow-spin 2s linear infinite" },
  },
  {
    id: "pulse-green",
    label: "Активный",
    description: "Зелёное пульсирующее свечение",
    keyframes: `@keyframes pulse-green { 0%,100%{box-shadow:0 0 4px 1px rgba(63,185,80,0.6),0 0 0 2px rgba(63,185,80,0.2)} 50%{box-shadow:0 0 16px 4px rgba(63,185,80,0.9),0 0 0 2px rgba(63,185,80,0.4)} }`,
    style: { border: "4px solid #3fb950", animation: "pulse-green 2s ease-in-out infinite" },
  },
  {
    id: "galaxy",
    label: "Галактика",
    description: "Тёмно-синяя рамка с мерцанием",
    keyframes: `@keyframes galaxy-shimmer { 0%,100%{border-color:#4752c4;box-shadow:0 0 8px 2px rgba(71,82,196,0.5)} 50%{border-color:#7c5cfc;box-shadow:0 0 20px 6px rgba(124,92,252,0.7)} }`,
    style: { border: "4px solid #4752c4", animation: "galaxy-shimmer 2.5s ease-in-out infinite" },
  },
  {
    id: "ice",
    label: "Лёд",
    description: "Холодная ледяная рамка",
    keyframes: `@keyframes ice-glow { 0%,100%{box-shadow:0 0 6px 2px rgba(149,225,255,0.5)} 50%{box-shadow:0 0 18px 5px rgba(149,225,255,0.85)} }`,
    style: { border: "4px solid #95e1ff", animation: "ice-glow 2s ease-in-out infinite" },
  },
  {
    id: "sakura",
    label: "Сакура",
    description: "Нежная розово-белая рамка",
    keyframes: `@keyframes sakura-fade { 0%,100%{border-color:#ffb8c6;box-shadow:0 0 4px rgba(255,184,198,0.4)} 50%{border-color:#ff8fab;box-shadow:0 0 12px rgba(255,143,171,0.7)} }`,
    style: { border: "4px solid #ffb8c6", animation: "sakura-fade 3s ease-in-out infinite" },
  },
  {
    id: "hacker",
    label: "Хакер",
    description: "Зелёный матричный эффект",
    keyframes: `@keyframes hacker-blink { 0%,100%{border-color:#00ff41;box-shadow:0 0 8px #00ff41} 40%{border-color:#00cc33;box-shadow:0 0 2px #00cc33} 60%{border-color:#00ff41;box-shadow:0 0 20px #00ff41} }`,
    style: { border: "4px solid #00ff41", animation: "hacker-blink 1s steps(2, end) infinite" },
  },
];

/** Helper: get frame object by id */
export function getFrameById(id?: string | null): AvatarFrame {
  return AVATAR_FRAMES.find((f) => f.id === id) ?? AVATAR_FRAMES[0];
}

/** Reusable avatar with frame applied */
export function AvatarWithFrame({
  src,
  frame,
  size = 48,
  className = "",
}: {
  src: string;
  frame?: string | null;
  size?: number;
  className?: string;
}) {
  const f = getFrameById(frame);
  return (
    <>
      {f.keyframes && <style>{f.keyframes}</style>}
      <img
        src={src}
        alt="avatar"
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size, ...f.style }}
      />
    </>
  );
}

interface Props {
  currentUser: User | null;
  setCurrentUser: (u: User) => void;
}

export default function AvatarFrameShop({ currentUser, setCurrentUser }: Props) {
  const [loading, setLoading] = useState(false);
  const activeFrame = currentUser?.avatar_frame ?? "none";

  const handleSelect = async (frameId: string) => {
    if (!currentUser || loading) return;
    setLoading(true);
    const prev = currentUser.avatar_frame;
    try {
      const frameVal = frameId === "none" ? null : frameId;
      setCurrentUser({ ...currentUser, avatar_frame: frameVal });
      await updateUserAvatarFrame(frameVal);
    } catch {
      setCurrentUser({ ...currentUser, avatar_frame: prev });
      alert("Не удалось сменить рамку");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-discord-secondary rounded-lg p-4 flex flex-col gap-3">
      <h3 className="text-discord-text-primary font-semibold text-sm">Рамка аватара</h3>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {AVATAR_FRAMES.map((frame) => {
          const isActive = activeFrame === frame.id;
          return (
            <button
              key={frame.id}
              onClick={() => handleSelect(frame.id)}
              disabled={loading}
              title={frame.description}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition ${
                isActive
                  ? "border-discord-accent bg-discord-accent/10"
                  : "border-discord-input hover:border-discord-accent/50 hover:bg-discord-input"
              }`}
            >
              {/* Preview */}
              {frame.keyframes && <style>{frame.keyframes}</style>}
              <div style={{ position: "relative", width: 44, height: 44 }}>
                <img
                  src={getImageUrl(currentUser?.avatar_url)}
                  alt="preview"
                  className="rounded-full object-cover"
                  style={{ width: 44, height: 44, ...frame.style }}
                />
              </div>
              <span className="text-discord-text-secondary text-xs text-center leading-tight">
                {frame.label}
              </span>
              {isActive && (
                <span className="text-discord-accent text-[10px] font-bold">✓ Активна</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
