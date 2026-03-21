import React, { useState, useRef, useEffect } from "react";
import { uploadFile } from "../services/api";
import { useI18n } from "../i18n";

interface Props {
  chatId: number;
  onClose: () => void;
}

const keyframes = `
@keyframes vnote-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(88,101,242,0.5); }
  50% { box-shadow: 0 0 0 12px rgba(88,101,242,0); }
}
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(235,69,158,0.4); }
  50% { box-shadow: 0 0 0 10px rgba(235,69,158,0); }
}
`;

const MAX_DURATION = 60; // seconds

export default function VideoNoteRecorder({ chatId, onClose }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<"preview" | "recording" | "uploading">("preview");
  const [seconds, setSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start camera preview on mount
  useEffect(() => {
    let cancelled = false;
    let s: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 480, height: 480 }, audio: true })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        s = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch(() => {
        alert(t.chat.voice_no_mic);
        onClose();
      });

    return () => {
      cancelled = true;
      if (s) s.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach stream to video when videoRef or stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Auto-stop at MAX_DURATION
  useEffect(() => {
    if (seconds >= MAX_DURATION && state === "recording") {
      stopAndSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const startRecording = () => {
    if (!stream) return;

    // Determine supported mimeType
    const mimeType = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const mr = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.start(200);
    mediaRecorderRef.current = mr;
    setState("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopAndSend = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;
    mediaRecorderRef.current = null;

    mr.onstop = async () => {
      if (timerRef.current) clearInterval(timerRef.current);

      const isWebm = mr.mimeType.includes("webm");
      const ext = isWebm ? "webm" : "mp4";
      const blob = new Blob(chunksRef.current, { type: mr.mimeType });
      const file = new File([blob], `videonote_${Date.now()}.${ext}`, { type: mr.mimeType });

      setState("uploading");
      try {
        await uploadFile(chatId, file);
        cleanup();
        onClose();
      } catch {
        alert(t.chat.voice_send_error);
        setState("preview");
      }
    };
    mr.stop();
  };

  const cleanup = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const cancel = () => {
    cleanup();
    onClose();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const progressFraction = seconds / MAX_DURATION;
  const circumference = 2 * Math.PI * 45; // r=45 in SVG viewBox 100

  return (
    <>
      <style>{keyframes}</style>
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
        {/* Circular video preview */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%", overflow: "hidden",
            border: state === "recording" ? "3px solid #5865f2" : "3px solid rgba(255,255,255,0.15)",
            animation: state === "recording" ? "vnote-pulse 1.5s ease-in-out infinite" : "none",
            transition: "border-color 0.2s ease",
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: "scaleX(-1)",
              }}
            />
          </div>

          {/* Progress ring (only while recording) */}
          {state === "recording" && (
            <svg
              width="108" height="108"
              viewBox="0 0 100 100"
              style={{
                position: "absolute", top: -4, left: -4,
                transform: "rotate(-90deg)",
                pointerEvents: "none",
              }}
            >
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke="rgba(88,101,242,0.6)"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progressFraction)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.3s linear" }}
              />
            </svg>
          )}
        </div>

        {/* Right side: info + buttons */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {state === "uploading" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg style={{ width: 18, height: 18, animation: "spin 1s linear infinite", color: "#5865f2" }} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
              </svg>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{t.chat.video_sending}</span>
            </div>
          ) : state === "recording" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", background: "#ed4245",
                  animation: "mic-pulse 1.2s ease-in-out infinite", flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#fff",
                  letterSpacing: "0.05em",
                }}>
                  {fmt(seconds)}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>/ {fmt(MAX_DURATION)}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={stopAndSend}
                  style={{
                    background: "linear-gradient(135deg, #5865f2, #7b68ee)",
                    color: "#fff", border: "none", borderRadius: 10,
                    padding: "7px 16px", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    boxShadow: "0 2px 12px rgba(88,101,242,0.4)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                  {t.chat.voice_send}
                </button>
                <button
                  onClick={cancel}
                  style={{
                    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                    padding: "7px 12px", fontSize: 13, cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(237,66,69,0.15)"; e.currentTarget.style.color = "#ed4245"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                >
                  {t.chat.cancel}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>{t.chat.video_message}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {MAX_DURATION} {t.chat.video_start_hint}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={startRecording}
                  style={{
                    background: "linear-gradient(135deg, #5865f2, #7b68ee)",
                    color: "#fff", border: "none", borderRadius: 10,
                    padding: "7px 16px", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    boxShadow: "0 2px 12px rgba(88,101,242,0.35)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ed4245", display: "inline-block" }} />
                  {t.chat.voice_record}
                </button>
                <button
                  onClick={cancel}
                  style={{
                    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                    padding: "7px 10px", fontSize: 16, cursor: "pointer",
                    transition: "all 0.15s ease", lineHeight: 1,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                >
                  ✕
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
