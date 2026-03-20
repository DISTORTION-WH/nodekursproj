import React, { useState, useRef, useEffect } from "react";
import { uploadFile } from "../services/api";
import { useI18n } from "../i18n";

interface Props {
  chatId: number;
  onClose: () => void;
}

const waveKeyframes = `
@keyframes wave-bar {
  0%, 100% { height: 4px; }
  50% { height: 22px; }
}
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(235,69,158,0.4); }
  50% { box-shadow: 0 0 0 10px rgba(235,69,158,0); }
}
`;

export default function VoiceRecorder({ chatId, onClose }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(200);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      alert(t.chat.voice_no_mic);
    }
  };

  const stopAndSend = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;
    mediaRecorderRef.current = null;
    mr.onstop = async () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const file = new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
      setUploading(true);
      try {
        await uploadFile(chatId, file);
        onClose();
      } catch (e) {
        alert(t.chat.voice_send_error);
      } finally {
        setUploading(false);
      }
      mr.stream.getTracks().forEach((t) => t.stop());
    };
    mr.stop();
    setRecording(false);
  };

  const cancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    setRecording(false);
    setSeconds(0);
    onClose();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const delays = [0, 100, 200, 300, 400, 500, 600];

  return (
    <>
      <style>{waveKeyframes}</style>
      <div
        className="rounded-t-2xl mb-0.5 px-5 py-4 flex items-center gap-4"
        style={{
          background: "var(--color-secondary)",
          border: "1px solid var(--color-tertiary)",
          borderBottom: "none",
        }}
      >
        {uploading ? (
          <div className="flex items-center gap-3 w-full">
            <svg className="w-4 h-4 text-discord-accent animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
            </svg>
            <span className="text-discord-text-secondary text-sm">{t.chat.voice_sending}</span>
          </div>
        ) : recording ? (
          <>
            {/* Red pulse dot */}
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#ed4245",
              animation: "mic-pulse 1.2s ease-in-out infinite",
              flexShrink: 0,
            }} />

            {/* Waveform bars */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, height: 28 }}>
              {delays.map((delay, i) => (
                <div key={i} style={{
                  width: 3,
                  height: 4,
                  borderRadius: 2,
                  background: "linear-gradient(to top, #5865f2, #eb459e)",
                  animation: `wave-bar 0.7s ease-in-out ${delay}ms infinite`,
                }} />
              ))}
            </div>

            {/* Timer */}
            <span className="text-discord-text-primary font-mono text-base font-semibold tracking-wider">
              {fmt(seconds)}
            </span>

            {/* Actions */}
            <div className="ml-auto flex gap-2">
              <button
                onClick={stopAndSend}
                className="bg-discord-accent hover:bg-discord-accent-hover text-white font-semibold text-sm px-4 py-1.5 rounded-lg transition flex items-center gap-1.5"
                style={{ boxShadow: "0 2px 12px rgba(88,101,242,0.4)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
                {t.chat.voice_send}
              </button>
              <button
                onClick={cancel}
                className="text-discord-text-muted hover:text-discord-danger border border-discord-tertiary hover:border-discord-danger/40 bg-discord-input hover:bg-discord-danger/10 text-sm px-3 py-1.5 rounded-lg transition"
              >
                {t.chat.cancel}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Mic icon */}
            <div className="w-9 h-9 rounded-full bg-discord-accent/15 border border-discord-accent/30 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-discord-text-primary">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>

            <div className="flex-1">
              <div className="text-discord-text-primary text-sm font-medium">{t.chat.voice_message}</div>
              <div className="text-discord-text-muted text-xs mt-0.5">{t.chat.voice_start_hint}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={startRecording}
                className="bg-discord-danger hover:opacity-90 text-white font-semibold text-sm px-4 py-1.5 rounded-lg transition flex items-center gap-2"
                style={{ boxShadow: "0 2px 12px rgba(237,66,69,0.35)" }}
              >
                <span className="w-2 h-2 rounded-full bg-white inline-block" />
                {t.chat.voice_record}
              </button>
              <button
                onClick={cancel}
                className="text-discord-text-muted hover:text-discord-text-primary border border-discord-tertiary bg-discord-input hover:bg-discord-input-hover text-sm px-3 py-1.5 rounded-lg transition"
              >
                ✕
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
