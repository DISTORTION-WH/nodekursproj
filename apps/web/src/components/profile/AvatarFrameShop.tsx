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
  // --- Solid elegant ---
  {
    id: "accent",
    label: "Индиго",
    description: "Элегантная фиолетовая рамка",
    style: { border: "3px solid #5865f2", boxShadow: "0 0 0 2px rgba(88,101,242,0.25), inset 0 0 0 1px rgba(88,101,242,0.15)" },
  },
  {
    id: "gold",
    label: "Престиж",
    description: "Золотая рамка с мягким блеском",
    style: { border: "3px solid #f5c542", boxShadow: "0 0 12px rgba(245,197,66,0.35), 0 0 0 2px rgba(245,197,66,0.15)" },
  },
  {
    id: "rose",
    label: "Розовый кварц",
    description: "Нежная градиентная рамка",
    style: { border: "3px solid #f472b6", boxShadow: "0 0 10px rgba(244,114,182,0.3), 0 0 0 2px rgba(244,114,182,0.15)" },
  },
  // --- Neon glow ---
  {
    id: "cyan",
    label: "Киберпанк",
    description: "Неоновое голубое свечение",
    keyframes: `@keyframes cyber-glow { 0%,100%{box-shadow:0 0 8px 2px rgba(0,212,255,0.6),0 0 20px 4px rgba(0,212,255,0.2)} 50%{box-shadow:0 0 14px 4px rgba(0,212,255,0.9),0 0 30px 8px rgba(0,212,255,0.3)} }`,
    style: { border: "3px solid #00d4ff", animation: "cyber-glow 2s ease-in-out infinite" },
  },
  {
    id: "fire",
    label: "Инферно",
    description: "Огненное пульсирующее сияние",
    keyframes: `@keyframes inferno { 0%,100%{border-color:#ed4245;box-shadow:0 0 8px 2px rgba(237,66,69,0.6),0 0 0 2px rgba(255,120,0,0.3)} 33%{border-color:#ff6b35;box-shadow:0 0 16px 4px rgba(255,107,53,0.8),0 0 0 2px rgba(255,200,0,0.4)} 66%{border-color:#ffc800;box-shadow:0 0 12px 3px rgba(255,200,0,0.7),0 0 0 2px rgba(237,66,69,0.3)} }`,
    style: { border: "3px solid #ed4245", animation: "inferno 2s ease-in-out infinite" },
  },
  // --- Color shift ---
  {
    id: "rainbow",
    label: "Призма",
    description: "Плавный переход через весь спектр",
    keyframes: `@keyframes prisma { 0%{border-color:#ff6b6b;box-shadow:0 0 10px rgba(255,107,107,0.4)} 20%{border-color:#feca57;box-shadow:0 0 10px rgba(254,202,87,0.4)} 40%{border-color:#48dbfb;box-shadow:0 0 10px rgba(72,219,251,0.4)} 60%{border-color:#ff9ff3;box-shadow:0 0 10px rgba(255,159,243,0.4)} 80%{border-color:#54a0ff;box-shadow:0 0 10px rgba(84,160,255,0.4)} 100%{border-color:#ff6b6b;box-shadow:0 0 10px rgba(255,107,107,0.4)} }`,
    style: { border: "3px solid #ff6b6b", animation: "prisma 4s linear infinite" },
  },
  {
    id: "aurora",
    label: "Аврора",
    description: "Северное сияние — зелёно-синий переход",
    keyframes: `@keyframes aurora { 0%,100%{border-color:#43e97b;box-shadow:0 0 12px rgba(67,233,123,0.5)} 33%{border-color:#38f9d7;box-shadow:0 0 12px rgba(56,249,215,0.5)} 66%{border-color:#667eea;box-shadow:0 0 12px rgba(102,126,234,0.5)} }`,
    style: { border: "3px solid #43e97b", animation: "aurora 3s ease-in-out infinite" },
  },
  // --- Pulse effects ---
  {
    id: "pulse-green",
    label: "Биосигнал",
    description: "Живое зелёное дыхание",
    keyframes: `@keyframes biosignal { 0%,100%{box-shadow:0 0 4px 1px rgba(63,185,80,0.5),0 0 0 2px rgba(63,185,80,0.15)} 50%{box-shadow:0 0 18px 6px rgba(63,185,80,0.8),0 0 0 2px rgba(63,185,80,0.3)} }`,
    style: { border: "3px solid #3fb950", animation: "biosignal 2.5s ease-in-out infinite" },
  },
  {
    id: "galaxy",
    label: "Галактика",
    description: "Глубокий космос с мерцанием",
    keyframes: `@keyframes galaxy { 0%,100%{border-color:#4752c4;box-shadow:0 0 8px 2px rgba(71,82,196,0.4),0 0 20px 4px rgba(124,92,252,0.1)} 50%{border-color:#9b59b6;box-shadow:0 0 14px 4px rgba(155,89,182,0.6),0 0 30px 8px rgba(124,92,252,0.2)} }`,
    style: { border: "3px solid #4752c4", animation: "galaxy 3s ease-in-out infinite" },
  },
  // --- Atmosphere ---
  {
    id: "ice",
    label: "Ледяной кристалл",
    description: "Морозное сверкающее свечение",
    keyframes: `@keyframes icecrystal { 0%,100%{border-color:#a5f3fc;box-shadow:0 0 6px 2px rgba(165,243,252,0.4),0 0 0 2px rgba(165,243,252,0.15)} 25%{border-color:#67e8f9;box-shadow:0 0 14px 4px rgba(103,232,249,0.6)} 75%{border-color:#cffafe;box-shadow:0 0 10px 3px rgba(207,250,254,0.5)} }`,
    style: { border: "3px solid #a5f3fc", animation: "icecrystal 2.5s ease-in-out infinite" },
  },
  {
    id: "sakura",
    label: "Сакура",
    description: "Нежное цветение вишни",
    keyframes: `@keyframes sakura { 0%,100%{border-color:#fbb6ce;box-shadow:0 0 6px rgba(251,182,206,0.4)} 50%{border-color:#f687b3;box-shadow:0 0 16px rgba(246,135,179,0.6),0 0 30px rgba(246,135,179,0.15)} }`,
    style: { border: "3px solid #fbb6ce", animation: "sakura 3.5s ease-in-out infinite" },
  },
  {
    id: "hacker",
    label: "Матрица",
    description: "Мерцающий зелёный код",
    keyframes: `@keyframes matrix { 0%{border-color:#00ff41;box-shadow:0 0 6px rgba(0,255,65,0.5)} 15%{box-shadow:0 0 2px rgba(0,204,51,0.3)} 30%{box-shadow:0 0 18px rgba(0,255,65,0.8)} 45%{box-shadow:0 0 4px rgba(0,255,65,0.4)} 60%{box-shadow:0 0 12px rgba(0,255,65,0.7)} 100%{border-color:#00ff41;box-shadow:0 0 6px rgba(0,255,65,0.5)} }`,
    style: { border: "3px solid #00ff41", animation: "matrix 1.5s steps(6) infinite" },
  },
  // --- Premium double-ring ---
  {
    id: "diamond",
    label: "Бриллиант",
    description: "Переливающийся алмазный блеск",
    keyframes: `@keyframes diamond { 0%,100%{border-color:#e2e8f0;box-shadow:0 0 8px rgba(226,232,240,0.5),0 0 0 3px rgba(148,163,184,0.2),0 0 0 6px rgba(226,232,240,0.1)} 50%{border-color:#f8fafc;box-shadow:0 0 20px rgba(248,250,252,0.8),0 0 0 3px rgba(203,213,225,0.4),0 0 0 6px rgba(248,250,252,0.15)} }`,
    style: { border: "3px solid #e2e8f0", animation: "diamond 2s ease-in-out infinite" },
  },
  {
    id: "sunset",
    label: "Закат",
    description: "Тёплый градиент заходящего солнца",
    keyframes: `@keyframes sunset { 0%,100%{border-color:#f97316;box-shadow:0 0 10px rgba(249,115,22,0.5)} 33%{border-color:#ec4899;box-shadow:0 0 10px rgba(236,72,153,0.5)} 66%{border-color:#a855f7;box-shadow:0 0 10px rgba(168,85,247,0.5)} }`,
    style: { border: "3px solid #f97316", animation: "sunset 4s ease-in-out infinite" },
  },
  {
    id: "toxic",
    label: "Токсик",
    description: "Ядовитый зелёно-жёлтый пульс",
    keyframes: `@keyframes toxic { 0%,100%{border-color:#a3e635;box-shadow:0 0 8px rgba(163,230,53,0.5)} 50%{border-color:#22d3ee;box-shadow:0 0 16px rgba(34,211,238,0.6),0 0 30px rgba(163,230,53,0.15)} }`,
    style: { border: "3px solid #a3e635", animation: "toxic 2s ease-in-out infinite" },
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
