import React, { useEffect, useRef, useState } from "react";
import { useLiveSubtitles } from "../hooks/useLiveSubtitles";
import type { Subtitle, StreamDescriptor } from "../hooks/useLiveSubtitles";
import { useCallFeatures } from "../context/CallFeaturesContext";
import { useSocket } from "../context/SocketContext";
import type { Socket } from "socket.io-client";

export type { StreamDescriptor };

// ─── Language options ─────────────────────────────────────────────────────────

export const SUBTITLE_LANGUAGES: { code: string; label: string }[] = [
  { code: "ru-RU", label: "Русский" },
  { code: "en-US", label: "English" },
  { code: "de-DE", label: "Deutsch" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español" },
  { code: "zh-CN", label: "中文" },
  { code: "ja-JP", label: "日本語" },
  { code: "it-IT", label: "Italiano" },
  { code: "pt-BR", label: "Português" },
  { code: "uk-UA", label: "Українська" },
  { code: "tr-TR", label: "Türkçe" },
  { code: "ko-KR", label: "한국어" },
];

// ─── Public props ─────────────────────────────────────────────────────────────

export interface SubtitlesOverlayProps {
  localStream: MediaStream | null;
  remoteStreams?: StreamDescriptor[];
  participantNames?: Map<string, string>;
  callActive: boolean;
  enabled?: boolean;
  lang?: string;
  bottomOffset?: number;
  audioAdapting?: boolean;
}

// ─── CC toggle button ─────────────────────────────────────────────────────────

export interface CCButtonProps {
  active: boolean;
  onToggle: () => void;
}

export function CCButton({ active, onToggle }: CCButtonProps) {
  return (
    <button
      onClick={onToggle}
      title={active ? "Отключить субтитры" : "Включить субтитры"}
      className={[
        "w-12 h-12 rounded-full flex items-center justify-center",
        "text-sm font-bold tracking-wide transition",
        active
          ? "bg-discord-input-hover text-white"
          : "bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary hover:text-white",
      ].join(" ")}
    >
      CC
    </button>
  );
}

// ─── Language dropdown ────────────────────────────────────────────────────────

export interface SubtitleLangSelectProps {
  value: string;
  onChange: (lang: string) => void;
  title?: string;
}

export function SubtitleLangSelect({ value, onChange, title = "Язык субтитров" }: SubtitleLangSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      className={[
        "h-9 rounded-lg px-2 border-0 outline-none cursor-pointer",
        "bg-discord-input hover:bg-discord-input-hover",
        "text-discord-text-secondary hover:text-white",
        "text-xs transition-colors appearance-none",
      ].join(" ")}
    >
      {SUBTITLE_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}

// ─── Subtitle settings popup ─────────────────────────────────────────────────

export interface SubtitleSettingsPopupProps {
  speechLang: string;
  displayLang: string;
  onSpeechLangChange: (lang: string) => void;
  onDisplayLangChange: (lang: string) => void;
  onClose: () => void;
}

export function SubtitleSettingsPopup({
  speechLang,
  displayLang,
  onSpeechLangChange,
  onDisplayLangChange,
  onClose,
}: SubtitleSettingsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50"
      style={{ minWidth: 280 }}
    >
      <div className="bg-discord-secondary rounded-xl shadow-2xl border border-white/10 p-4 flex flex-col gap-4">
        <div className="text-white text-sm font-semibold text-center">
          Настройки субтитров
        </div>

        {/* Display lang — "Мой язык" (rec.lang + translation target) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-discord-text-muted text-xs font-medium">
            Мой язык
          </label>
          <p className="text-discord-text-muted text-[10px] -mt-1 leading-tight">
            Язык, на котором вы говорите. Субтитры собеседника будут переведены на этот язык.
          </p>
          <select
            value={displayLang}
            onChange={(e) => onDisplayLangChange(e.target.value)}
            className={[
              "h-10 rounded-lg px-3 border-0 outline-none cursor-pointer w-full",
              "bg-discord-input hover:bg-discord-input-hover",
              "text-white text-sm transition-colors",
            ].join(" ")}
          >
            {SUBTITLE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Speech lang — "Язык собеседника" (translation source) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-discord-text-muted text-xs font-medium">
            Язык собеседника
          </label>
          <p className="text-discord-text-muted text-[10px] -mt-1 leading-tight">
            Язык, на котором говорит ваш собеседник. Его речь будет распознана и переведена.
          </p>
          <select
            value={speechLang}
            onChange={(e) => onSpeechLangChange(e.target.value)}
            className={[
              "h-10 rounded-lg px-3 border-0 outline-none cursor-pointer w-full",
              "bg-discord-input hover:bg-discord-input-hover",
              "text-white text-sm transition-colors",
            ].join(" ")}
          >
            {SUBTITLE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onClose}
          className="mt-1 h-9 rounded-lg bg-discord-accent hover:bg-discord-accent/80 text-white text-sm font-medium transition-colors"
        >
          Готово
        </button>
      </div>
    </div>
  );
}

// ─── Display entry with fade-out ──────────────────────────────────────────────

interface DisplayEntry {
  id: number;
  speakerId: string;
  speakerName: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
  finalizedAt: number | null;
  fading: boolean;
}

const HOLD_MS = 5000;
const FADE_MS = 600;
const MAX_LINES = 3;
const TICK_MS = 200;

let _seq = 0;
const nextId = () => ++_seq;

// ─── SubtitleLine ─────────────────────────────────────────────────────────────

function SubtitleLine({ entry }: { entry: DisplayEntry }) {
  return (
    <div
      style={{
        opacity: entry.fading ? 0 : entry.isFinal ? 1 : 0.7,
        fontStyle: entry.isFinal ? "normal" : "italic",
        transition: entry.fading ? `opacity ${FADE_MS}ms ease-out` : "opacity 0.12s ease-in",
        lineHeight: 1.5,
        padding: "2px 0",
      }}
    >
      <span
        style={{
          background: "rgba(0,0,0,0.75)",
          borderRadius: 5,
          padding: "3px 12px",
          display: "inline",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }}
      >
        <span style={{ fontWeight: 700, marginRight: 5, color: "rgba(168,180,255,0.9)" }}>
          {entry.speakerName}:
        </span>
        {entry.text}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubtitlesOverlay({
  localStream: localStreamProp,
  callActive,
  enabled: enabledProp,
  lang: langProp,
  bottomOffset = 80,
  audioAdapting: audioAdaptingProp,
}: SubtitlesOverlayProps) {
  const ctx = useCallFeatures();
  const { socket } = useSocket() as { socket: Socket | null };

  const enabled     = enabledProp !== undefined ? enabledProp : ctx.subtitlesEnabled;
  const displayLang = ctx.displayLang ?? (langProp ?? "ru-RU");
  const audioAdapting = audioAdaptingProp !== undefined ? audioAdaptingProp : ctx.networkQuality.isAdapting;

  const remoteUserId: number | null = ctx.scenario === "p2p" ? (ctx.remoteParticipantUserId ?? null) : null;
  const groupChatId: number | null = ctx.scenario === "group" ? (ctx.groupChatId ?? null) : null;
  const localUsername = ctx.participantNames.get("local") ?? "Вы";
  const localSpeakerId = ctx.localSpeakerId ?? "local";

  const speechLang = ctx.speechLang ?? "en-US";

  const { subtitles, isListening, error } = useLiveSubtitles({
    localStream: callActive ? localStreamProp : null,
    speechLang,
    displayLang,
    callActive,
    showSubtitles: enabled,
    socket,
    remoteUserId,
    groupChatId,
    localUsername,
    localSpeakerId,
  });

  // ── Display buffer with fade-out ──────────────────────────────────────────
  const [display, setDisplay] = useState<DisplayEntry[]>([]);
  const prevSubRef = useRef<Subtitle[]>([]);

  useEffect(() => {
    if (subtitles === prevSubRef.current) return;
    const next = subtitles;
    prevSubRef.current = next;

    // Find new/updated entries
    setDisplay((entries) => {
      let updated = [...entries];

      for (const sub of next) {
        const existingIdx = updated.findIndex(
          (e) => e.speakerId === sub.speakerId && !e.isFinal && !e.fading
        );

        if (!sub.isFinal) {
          // Interim: update existing or add new
          if (existingIdx !== -1) {
            updated[existingIdx] = { ...updated[existingIdx], text: sub.text, speakerName: sub.speakerName, timestamp: sub.timestamp };
          } else {
            updated = [...updated, {
              id: nextId(), speakerId: sub.speakerId, speakerName: sub.speakerName,
              text: sub.text, isFinal: false, timestamp: sub.timestamp, finalizedAt: null, fading: false,
            }];
          }
        } else {
          // Final: check if this is genuinely new (not already in display)
          const alreadyShown = updated.some(
            (e) => e.speakerId === sub.speakerId && e.isFinal && e.text === sub.text
          );
          if (existingIdx !== -1) {
            // Promote interim → final
            updated[existingIdx] = { ...updated[existingIdx], text: sub.text, speakerName: sub.speakerName, isFinal: true, finalizedAt: Date.now() };
          } else if (!alreadyShown) {
            updated = [...updated, {
              id: nextId(), speakerId: sub.speakerId, speakerName: sub.speakerName,
              text: sub.text, isFinal: true, timestamp: sub.timestamp, finalizedAt: Date.now(), fading: false,
            }];
          }
        }
      }

      // Trim to MAX_LINES visible
      const visible = updated.filter((e) => !e.fading);
      if (visible.length > MAX_LINES) {
        const toDrop = new Set(visible.slice(0, visible.length - MAX_LINES).map((e) => e.id));
        updated = updated.filter((e) => !toDrop.has(e.id));
      }

      return updated;
    });
  }, [subtitles]);

  // Fade-out tick
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setDisplay((entries) => {
        let changed = false;
        const next = entries
          .map((e) => {
            if (e.isFinal && !e.fading && e.finalizedAt !== null && now - e.finalizedAt >= HOLD_MS) {
              changed = true;
              return { ...e, fading: true };
            }
            return e;
          })
          .filter((e) => {
            if (e.fading && e.finalizedAt !== null && now - e.finalizedAt >= HOLD_MS + FADE_MS) {
              changed = true;
              return false;
            }
            return true;
          });
        return changed ? next : entries;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!enabled) setDisplay([]);
  }, [enabled]);

  if (!callActive || !enabled) return null;

  const visibleLines = display.slice(-MAX_LINES);

  return (
    <div
      aria-live="polite"
      aria-label="Субтитры"
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(760px, 96%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        pointerEvents: "none",
        zIndex: 12,
        fontSize: "clamp(0.8rem, 1.9vw, 1.05rem)",
        textAlign: "center",
        color: "#fff",
      }}
    >
      {visibleLines.map((entry) => (
        <SubtitleLine key={entry.id} entry={entry} />
      ))}
      {audioAdapting && (
        <div style={{ background: "rgba(0,0,0,0.72)", color: "#faa81a", fontSize: "0.7rem", borderRadius: 4, padding: "2px 8px" }}>
          ⚠️ Качество аудио снижено
        </div>
      )}
      {error && (
        <div style={{ background: "rgba(0,0,0,0.72)", color: "#f87171", fontSize: "0.7rem", borderRadius: 4, padding: "2px 8px" }}>
          {error}
        </div>
      )}
      {!error && visibleLines.length === 0 && (
        <div style={{ background: "rgba(0,0,0,0.52)", color: isListening ? "rgba(87,242,135,0.8)" : "rgba(255,255,255,0.4)", fontSize: "0.65rem", borderRadius: 4, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: isListening ? "#57f287" : "#f87171", display: "inline-block", flexShrink: 0 }} />
          {isListening ? "Слушаю..." : "Переподключение..."}
        </div>
      )}
    </div>
  );
}
