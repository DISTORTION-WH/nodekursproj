import React, { useState, useRef, useEffect } from "react";
import { uploadFile } from "../services/api";

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(200);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      alert("Нет доступа к микрофону");
    }
  };

  const stopAndSend = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.onstop = async () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const file = new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
      setUploading(true);
      try {
        await uploadFile(chatId, file);
        onClose();
      } catch (e) {
        alert("Ошибка отправки голосового сообщения");
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
      <div style={{
        background: "rgba(20,21,35,0.97)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(88,101,242,0.1)",
        borderRadius: "16px 16px 0 0",
        padding: "16px 20px",
        marginBottom: "2px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}>
        {uploading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
            <svg style={{ width: 18, height: 18, animation: "spin 1s linear infinite", color: "#5865f2" }} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
            </svg>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Отправка голосового...</span>
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
            <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600, color: "white", letterSpacing: "0.05em" }}>
              {fmt(seconds)}
            </span>

            {/* Actions */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={stopAndSend}
                style={{
                  background: "linear-gradient(135deg, #5865f2, #7b68ee)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "7px 16px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  boxShadow: "0 2px 12px rgba(88,101,242,0.4)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(88,101,242,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 12px rgba(88,101,242,0.4)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
                Отправить
              </button>
              <button
                onClick={cancel}
                style={{
                  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                  padding: "7px 12px", fontSize: 13, cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(237,66,69,0.15)"; e.currentTarget.style.color = "#ed4245"; e.currentTarget.style.borderColor = "rgba(237,66,69,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                Отмена
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Mic icon */}
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(88,101,242,0.15)",
              border: "1px solid rgba(88,101,242,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "white", fontWeight: 500 }}>Голосовое сообщение</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Нажмите запись, чтобы начать</div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={startRecording}
                style={{
                  background: "linear-gradient(135deg, #ed4245, #c0392b)",
                  color: "white", border: "none", borderRadius: 10,
                  padding: "7px 16px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  boxShadow: "0 2px 12px rgba(237,66,69,0.35)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(237,66,69,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 12px rgba(237,66,69,0.35)"; }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "white", display: "inline-block" }} />
                Запись
              </button>
              <button
                onClick={cancel}
                style={{
                  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                  padding: "7px 10px", fontSize: 16, cursor: "pointer",
                  transition: "all 0.15s ease", lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
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
