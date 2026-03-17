import React, { useState, useRef, useEffect } from "react";
import { uploadFile } from "../services/api";

interface Props {
  chatId: number;
  onClose: () => void;
}

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

  return (
    <div className="flex items-center gap-3 bg-discord-tertiary rounded-t-lg px-3 py-2 mb-0.5">
      {uploading ? (
        <span className="text-discord-text-muted text-sm">Отправка...</span>
      ) : recording ? (
        <>
          <span className="w-2 h-2 rounded-full bg-discord-danger animate-pulse shrink-0" />
          <span className="text-discord-text-primary text-sm font-mono">{fmt(seconds)}</span>
          <button
            onClick={stopAndSend}
            className="ml-auto bg-discord-accent hover:bg-discord-accent-hover text-white text-xs px-3 py-1 rounded transition"
          >
            Отправить
          </button>
          <button
            onClick={cancel}
            className="text-discord-text-muted hover:text-discord-danger text-xs px-2 py-1 rounded transition"
          >
            Отмена
          </button>
        </>
      ) : (
        <>
          <span className="text-discord-text-muted text-sm">Запись голосового...</span>
          <button
            onClick={startRecording}
            className="ml-auto bg-discord-danger hover:bg-discord-danger-hover text-white text-xs px-3 py-1 rounded transition flex items-center gap-1"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
            Запись
          </button>
          <button
            onClick={cancel}
            className="text-discord-text-muted hover:text-discord-text-primary text-xs px-2 py-1 rounded transition"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
