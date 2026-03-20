import { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { translateText, toLangCode } from "./useTranslate";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Subtitle {
  id: number;
  speakerId: string;
  speakerName: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface StreamDescriptor {
  participantId: string;
  stream: MediaStream | null;
}

export interface UseLiveSubtitlesOptions {
  localStream: MediaStream | null;
  speechLang?: string;
  displayLang?: string;
  showSubtitles?: boolean;
  callActive?: boolean;
  socket?: Socket | null;
  remoteUserId?: number | null;
  groupChatId?: number | null;
  localUsername?: string;
  localSpeakerId?: string;
  // legacy compat
  enabled?: boolean;
  lang?: string;
  remoteStreams?: StreamDescriptor[];
}

export interface UseLiveSubtitlesResult {
  subtitles: Subtitle[];
  isListening: boolean;
  error: string | null;
  setLanguage: (lang: string) => void;
  toggleSubtitles: () => void;
}

let _idSeq = 0;
const uid = () => ++_idSeq;

// ─── AudioWorklet processor (inline blob) ────────────────────────────────────

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 0;
    this._targetSize = 4096;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const samples = input[0];
    const ratio = Math.round(sampleRate / 16000) || 3;
    const downsampled = new Float32Array(Math.ceil(samples.length / ratio));
    for (let i = 0, j = 0; i < samples.length; i += ratio, j++) {
      downsampled[j] = samples[i];
    }
    const pcm16 = new Int16Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) {
      const s = Math.max(-1, Math.min(1, downsampled[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this._buffer.push(pcm16);
    this._bufferSize += pcm16.length;
    if (this._bufferSize >= this._targetSize) {
      const merged = new Int16Array(this._bufferSize);
      let offset = 0;
      for (const chunk of this._buffer) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this.port.postMessage(merged.buffer, [merged.buffer]);
      this._buffer = [];
      this._bufferSize = 0;
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

let workletBlobUrl: string | null = null;
function getWorkletUrl(): string {
  if (!workletBlobUrl) {
    const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    workletBlobUrl = URL.createObjectURL(blob);
  }
  return workletBlobUrl;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveSubtitles({
  localStream,
  speechLang = "en-US",
  displayLang = "ru-RU",
  showSubtitles,
  callActive = false,
  enabled,
  socket = null,
  remoteUserId = null,
  groupChatId = null,
  localUsername = "Вы",
  localSpeakerId = "local",
}: UseLiveSubtitlesOptions): UseLiveSubtitlesResult {
  const shouldShow = showSubtitles ?? enabled ?? false;

  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync refs
  const shouldShowRef = useRef(shouldShow);
  const speechLangRef = useRef(speechLang);
  const displayLangRef = useRef(displayLang);
  const socketRef = useRef(socket);
  const remoteUserIdRef = useRef(remoteUserId);
  const groupChatIdRef = useRef(groupChatId);
  const localUsernameRef = useRef(localUsername);
  const localSpeakerIdRef = useRef(localSpeakerId);

  shouldShowRef.current = shouldShow;
  speechLangRef.current = speechLang;
  displayLangRef.current = displayLang;
  socketRef.current = socket;
  remoteUserIdRef.current = remoteUserId;
  groupChatIdRef.current = groupChatId;
  localUsernameRef.current = localUsername;
  localSpeakerIdRef.current = localSpeakerId;

  // Audio pipeline refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamingRef = useRef(false);
  const interimTranslateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Upsert subtitle entry ──────────────────────────────────────────────────
  const upsertSubtitle = useCallback(
    (speakerId: string, speakerName: string, text: string, isFinal: boolean) => {
      setSubtitles((prev) => {
        const lastInterimIdx = !isFinal
          ? (() => {
              for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].speakerId === speakerId && !prev[i].isFinal) return i;
              }
              return -1;
            })()
          : -1;

        if (!isFinal && lastInterimIdx !== -1) {
          const updated = [...prev];
          updated[lastInterimIdx] = { ...updated[lastInterimIdx], text, timestamp: Date.now() };
          return updated;
        }

        const base = isFinal
          ? prev.filter((s) => !(s.speakerId === speakerId && !s.isFinal))
          : prev;

        const entry: Subtitle = {
          id: uid(), speakerId, speakerName, text, isFinal, timestamp: Date.now(),
        };
        const next = [...base, entry];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });
    },
    []
  );

  // ── Build subtitle_audio_start payload ────────────────────────────────────
  const buildPayload = useCallback(() => {
    const payload: Record<string, any> = {
      lang: displayLangRef.current,
      username: localUsernameRef.current,
    };
    if (remoteUserIdRef.current) payload.to = remoteUserIdRef.current;
    else if (groupChatIdRef.current) payload.chatId = groupChatIdRef.current;
    return payload;
  }, []);

  // ── Start audio pipeline + Deepgram session ───────────────────────────────
  const startStreaming = useCallback(async () => {
    if (!localStream || !socket || streamingRef.current) return;

    try {
      const payload = buildPayload();
      console.log("[SUBTITLES] subtitle_audio_start →", payload);
      socket.emit("subtitle_audio_start", payload);

      const audioCtx = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioCtx;

      await audioCtx.audioWorklet.addModule(getWorkletUrl());

      const source = audioCtx.createMediaStreamSource(localStream);
      sourceNodeRef.current = source;

      const workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
      workletNodeRef.current = workletNode;

      let chunkCount = 0;
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (socketRef.current && streamingRef.current) {
          socketRef.current.emit("subtitle_audio_chunk", event.data);
          if (++chunkCount <= 3) {
            console.log(`[SUBTITLES] chunk #${chunkCount} → ${event.data.byteLength}B`);
          }
        }
      };

      source.connect(workletNode);
      // Silent sink — keeps the audio graph alive without echo
      const silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;
      workletNode.connect(silentGain);
      silentGain.connect(audioCtx.destination);

      streamingRef.current = true;
      setIsListening(true);
      setError(null);
      console.log("[SUBTITLES] Audio pipeline started");
    } catch (err: any) {
      console.error("[SUBTITLES] Failed to start pipeline:", err);
      setError("Не удалось запустить захват аудио");
      setIsListening(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, socket]);

  const stopStreaming = useCallback(() => {
    if (!streamingRef.current) return;
    streamingRef.current = false;
    setIsListening(false);

    try { workletNodeRef.current?.disconnect(); } catch { /**/ }
    try { sourceNodeRef.current?.disconnect(); } catch { /**/ }
    try { audioContextRef.current?.close(); } catch { /**/ }

    workletNodeRef.current = null;
    sourceNodeRef.current = null;
    audioContextRef.current = null;

    socketRef.current?.emit("subtitle_audio_stop");
    console.log("[SUBTITLES] Audio pipeline stopped");
  }, []);

  // ── Re-notify server when routing info changes (remoteUserId / groupChatId) ─
  // This handles the case where startStreaming ran before callerData was set
  useEffect(() => {
    if (!streamingRef.current || !socketRef.current) return;
    const payload = buildPayload();
    console.log("[SUBTITLES] subtitle_session_update →", payload);
    socketRef.current.emit("subtitle_session_update", payload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUserId, groupChatId]);

  // ── Start/stop based on callActive ─────────────────────────────────────────
  useEffect(() => {
    if (callActive && localStream && socket) {
      startStreaming();
    } else {
      stopStreaming();
    }
    return () => { stopStreaming(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, localStream, socket]);

  // ── Restart when displayLang changes ──────────────────────────────────────
  useEffect(() => {
    if (!streamingRef.current || !socketRef.current) return;
    stopStreaming();
    const t = setTimeout(() => startStreaming(), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayLang]);

  // ── Receive transcription results from server ──────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onReceived = (data: {
      text: string;
      speakerId: string;
      username: string;
      isFinal: boolean;
      lang?: string;
    }) => {
      console.log("[SUBTITLES] subtitle_received:", data.text?.substring(0, 60), "| final:", data.isFinal, "| show:", shouldShowRef.current);
      if (!shouldShowRef.current) return;

      const sourceLang = data.lang || speechLangRef.current;
      const targetLang = displayLangRef.current;
      const isLocalSpeaker = data.speakerId === localSpeakerIdRef.current;

      // Our own speech — show as-is (no translation needed)
      if (isLocalSpeaker) {
        upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
        return;
      }

      // Remote speech — translate if languages differ
      const needsTranslation = toLangCode(sourceLang) !== toLangCode(targetLang);

      if (!needsTranslation) {
        upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
        return;
      }

      if (data.isFinal) {
        translateText(data.text, sourceLang, targetLang).then((translated) => {
          upsertSubtitle(data.speakerId, data.username, translated, true);
        });
      } else {
        // Show original immediately, translate with debounce
        upsertSubtitle(data.speakerId, data.username, data.text, false);

        if (interimTranslateTimerRef.current) clearTimeout(interimTranslateTimerRef.current);
        interimTranslateTimerRef.current = setTimeout(() => {
          translateText(data.text, sourceLang, targetLang).then((translated) => {
            if (translated !== data.text) {
              upsertSubtitle(data.speakerId, data.username, translated, false);
            }
          });
        }, 600);
      }
    };

    socket.on("subtitle_received", onReceived);
    return () => {
      socket.off("subtitle_received", onReceived);
      if (interimTranslateTimerRef.current) clearTimeout(interimTranslateTimerRef.current);
    };
  }, [socket, upsertSubtitle]);

  // Clear when disabled
  useEffect(() => {
    if (!shouldShow) setSubtitles([]);
  }, [shouldShow]);

  const setLanguage = useCallback((_lang: string) => {}, []);
  const toggleSubtitles = useCallback(() => {}, []);

  return { subtitles, isListening, error, setLanguage, toggleSubtitles };
}
