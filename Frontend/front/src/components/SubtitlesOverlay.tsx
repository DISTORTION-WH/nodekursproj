import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLiveSubtitles, StreamDescriptor } from "../hooks/useLiveSubtitles";
import type { Subtitle } from "../hooks/useLiveSubtitles";

// ─── Language options ─────────────────────────────────────────────────────────

export const SUBTITLE_LANGUAGES: { code: string; label: string }[] = [
  { code: "ru-RU", label: "Русский" },
  { code: "en-US", label: "English" },
  { code: "de-DE", label: "Deutsch" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español" },
  { code: "zh-CN", label: "中文" },
  { code: "ja-JP", label: "日本語" },
];

// ─── Public props ─────────────────────────────────────────────────────────────

export interface SubtitlesOverlayProps {
  localStream: MediaStream | null;
  remoteStreams?: StreamDescriptor[];
  /** Map of speakerId → display name shown in subtitles */
  participantNames?: Map<string, string>;
  /** Whether the call is active. When false, subtitles are hidden. */
  callActive: boolean;
  /** Controlled: whether subtitles are enabled */
  enabled: boolean;
  /** BCP-47 language tag, e.g. "ru-RU" */
  lang: string;
  /** px offset from bottom — lets caller push subtitles above the control bar */
  bottomOffset?: number;
}

// ─── CC toggle button (exported for use in CallOverlay control bar) ───────────

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

// ─── Language dropdown (exported for use in CallOverlay control bar) ──────────

export interface SubtitleLangSelectProps {
  value: string;
  onChange: (lang: string) => void;
}

export function SubtitleLangSelect({ value, onChange }: SubtitleLangSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title="Язык субтитров"
      className={[
        "h-9 rounded-lg px-2 border-0 outline-none cursor-pointer",
        "bg-discord-input hover:bg-discord-input-hover",
        "text-discord-text-secondary hover:text-white",
        "text-xs transition-colors appearance-none",
      ].join(" ")}
    >
      {SUBTITLE_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

// ─── Internal display entry ───────────────────────────────────────────────────

interface DisplayEntry {
  id: number;
  speakerId: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
  finalizedAt: number | null;
  fading: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HOLD_MS = 4000;
const FADE_MS = 600;
const MAX_LINES = 3;
const TICK_MS = 100;

let _idCounter = 0;
const nextId = () => ++_idCounter;

// ─── SubtitleLine ─────────────────────────────────────────────────────────────

function SubtitleLine({
  entry,
  speakerName,
}: {
  entry: DisplayEntry;
  speakerName: string;
}) {
  return (
    <div
      style={{
        opacity: entry.fading ? 0 : entry.isFinal ? 1 : 0.65,
        fontStyle: entry.isFinal ? "normal" : "italic",
        transition: entry.fading
          ? `opacity ${FADE_MS}ms ease-out`
          : "opacity 0.15s ease-in",
        lineHeight: 1.4,
        padding: "2px 0",
      }}
    >
      <span
        style={{
          background: "rgba(0,0,0,0.72)",
          borderRadius: 4,
          padding: "2px 10px",
          display: "inline",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }}
      >
        <span style={{ fontWeight: 600, marginRight: 4 }}>{speakerName}:</span>
        {entry.text}
      </span>
    </div>
  );
}

// ─── SubtitlesOverlay ────────────────────────────────────────────────────────

export default function SubtitlesOverlay({
  localStream,
  remoteStreams = [],
  participantNames = new Map(),
  callActive,
  enabled,
  lang,
  bottomOffset = 80,
}: SubtitlesOverlayProps) {
  // Pass streams to hook only when active + enabled
  const activeLocal = callActive && enabled ? localStream : null;
  const activeRemote = callActive && enabled ? remoteStreams : [];

  const { subtitles, error } = useLiveSubtitles({
    localStream: activeLocal,
    remoteStreams: activeRemote,
    lang,
  });

  // ── Display buffer ─────────────────────────────────────────────────────────
  const [display, setDisplay] = useState<DisplayEntry[]>([]);
  const prevSubtitlesRef = useRef<Subtitle[]>([]);

  useEffect(() => {
    const prev = prevSubtitlesRef.current;
    const next = subtitles;
    prevSubtitlesRef.current = next;
    if (next === prev) return;

    setDisplay((entries) => {
      let updated = [...entries];

      for (const sub of next) {
        const existingIdx = updated.findIndex(
          (e) => e.speakerId === sub.speakerId && !e.isFinal && !e.fading
        );

        if (!sub.isFinal) {
          if (existingIdx !== -1) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              text: sub.text,
              timestamp: sub.timestamp,
            };
          } else {
            updated = [
              ...updated,
              {
                id: nextId(),
                speakerId: sub.speakerId,
                text: sub.text,
                isFinal: false,
                timestamp: sub.timestamp,
                finalizedAt: null,
                fading: false,
              },
            ];
            const visible = updated.filter((e) => !e.fading);
            if (visible.length > MAX_LINES) {
              const drop = new Set(
                visible.slice(0, visible.length - MAX_LINES).map((e) => e.id)
              );
              updated = updated.filter((e) => !drop.has(e.id));
            }
          }
        } else {
          if (existingIdx !== -1) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              text: sub.text,
              isFinal: true,
              finalizedAt: Date.now(),
            };
          } else {
            const alreadyFinal = updated.some(
              (e) =>
                e.speakerId === sub.speakerId &&
                e.isFinal &&
                e.text === sub.text &&
                Date.now() - e.timestamp < 500
            );
            if (!alreadyFinal) {
              updated = [
                ...updated,
                {
                  id: nextId(),
                  speakerId: sub.speakerId,
                  text: sub.text,
                  isFinal: true,
                  timestamp: sub.timestamp,
                  finalizedAt: Date.now(),
                  fading: false,
                },
              ];
              const visible = updated.filter((e) => !e.fading);
              if (visible.length > MAX_LINES) {
                const drop = new Set(
                  visible.slice(0, visible.length - MAX_LINES).map((e) => e.id)
                );
                updated = updated.filter((e) => !drop.has(e.id));
              }
            }
          }
        }
      }

      return updated;
    });
  }, [subtitles]);

  // ── Fade-out + removal tick ────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
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
    return () => clearInterval(interval);
  }, []);

  // Clear display when disabled
  useEffect(() => {
    if (!enabled) setDisplay([]);
  }, [enabled]);

  const getDisplayName = useCallback(
    (speakerId: string) =>
      participantNames.get(speakerId) ?? (speakerId === "local" ? "Вы" : speakerId),
    [participantNames]
  );

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
        width: "min(720px, 94%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        pointerEvents: "none",
        zIndex: 10,
        fontSize: "clamp(0.78rem, 1.8vw, 1rem)",
        textAlign: "center",
        color: "#fff",
      }}
    >
      {visibleLines.map((entry) => (
        <SubtitleLine
          key={entry.id}
          entry={entry}
          speakerName={getDisplayName(entry.speakerId)}
        />
      ))}
      {error && (
        <div
          style={{
            background: "rgba(0,0,0,0.72)",
            color: "#f87171",
            fontSize: "0.7rem",
            borderRadius: 4,
            padding: "2px 8px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
