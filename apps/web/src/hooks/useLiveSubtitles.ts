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
  /** "Язык собеседника" — source language for translating incoming text */
  speechLang?: string;
  /** "Мой язык" — recognition language + translation target */
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

// ─── AudioWorklet processor inline code ──────────────────────────────────────
// We create a Blob URL for the worklet processor so we don't need a separate file.

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 0;
    // Send chunks of ~4096 samples (256ms at 16kHz) for efficient network usage
    this._targetSize = 4096;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const samples = input[0]; // Float32 mono
    // Downsample from 48kHz (or whatever) to 16kHz inline
    // AudioContext usually runs at 48kHz; Deepgram expects 16kHz
    // Simple decimation by factor of 3 (48000/16000 = 3)
    const ratio = Math.round(sampleRate / 16000);
    const downsampled = new Float32Array(Math.ceil(samples.length / ratio));
    for (let i = 0, j = 0; i < samples.length; i += ratio, j++) {
      downsampled[j] = samples[i];
    }
    // Convert to PCM16 LE
    const pcm16 = new Int16Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) {
      const s = Math.max(-1, Math.min(1, downsampled[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this._buffer.push(pcm16);
    this._bufferSize += pcm16.length;
    if (this._bufferSize >= this._targetSize) {
      // Merge and send
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

  // Refs
  const shouldShowRef = useRef(shouldShow);
  const speechLangRef = useRef(speechLang);
  const displayLangRef = useRef(displayLang);
  const socketRef = useRef(socket);
  const remoteUserIdRef = useRef(remoteUserId);
  const groupChatIdRef = useRef(groupChatId);
  const localUsernameRef = useRef(localUsername);
  const localSpeakerIdRef = useRef(localSpeakerId);

  // Audio pipeline refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamingRef = useRef(false);

  // Interim translation debounce
  const interimTranslateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  shouldShowRef.current = shouldShow;
  speechLangRef.current = speechLang;
  displayLangRef.current = displayLang;
  socketRef.current = socket;
  remoteUserIdRef.current = remoteUserId;
  groupChatIdRef.current = groupChatId;
  localUsernameRef.current = localUsername;
  localSpeakerIdRef.current = localSpeakerId;

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
          updated[lastInterimIdx] = {
            ...updated[lastInterimIdx],
            text,
            timestamp: Date.now(),
          };
          return updated;
        }

        const base = isFinal
          ? prev.filter((s) => !(s.speakerId === speakerId && !s.isFinal))
          : prev;

        const entry: Subtitle = {
          id: uid(),
          speakerId,
          speakerName,
          text,
          isFinal,
          timestamp: Date.now(),
        };
        const next = [...base, entry];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });
    },
    []
  );

  // ── Start streaming audio to backend Deepgram ─────────────────────────────
  const startStreaming = useCallback(async () => {
    if (!localStream || !socket || streamingRef.current) return;

    try {
      // Tell server to start a Deepgram session
      const startPayload: any = {
        lang: displayLangRef.current,
        username: localUsernameRef.current,
      };
      if (remoteUserIdRef.current) {
        startPayload.to = remoteUserIdRef.current;
      } else if (groupChatIdRef.current) {
        startPayload.chatId = groupChatIdRef.current;
      }
      console.log("[SUBTITLES] Starting audio stream, payload:", startPayload);
      socket.emit("subtitle_audio_start", startPayload);

      // Set up AudioWorklet pipeline to capture PCM from microphone
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioCtx;

      await audioCtx.audioWorklet.addModule(getWorkletUrl());

      const source = audioCtx.createMediaStreamSource(localStream);
      sourceNodeRef.current = source;

      const workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
      workletNodeRef.current = workletNode;

      // When the worklet sends PCM chunks, forward them to the server
      let chunkCount = 0;
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (socketRef.current && streamingRef.current) {
          socketRef.current.emit("subtitle_audio_chunk", event.data);
          chunkCount++;
          if (chunkCount <= 3) {
            console.log(`[SUBTITLES] Audio chunk #${chunkCount} sent, size: ${event.data.byteLength} bytes`);
          }
        }
      };

      source.connect(workletNode);
      // Connect to a silent GainNode to keep the audio graph alive
      // (AudioWorklet needs to be connected to process() to fire)
      const silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;
      workletNode.connect(silentGain);
      silentGain.connect(audioCtx.destination);

      streamingRef.current = true;
      setIsListening(true);
      setError(null);
    } catch (err: any) {
      console.error("[SUBTITLES] Error starting audio stream:", err);
      setError("Не удалось запустить аудиозахват");
      setIsListening(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, socket]);

  const stopStreaming = useCallback(() => {
    streamingRef.current = false;
    setIsListening(false);

    // Disconnect audio nodes
    if (workletNodeRef.current) {
      try { workletNodeRef.current.disconnect(); } catch { /* */ }
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch { /* */ }
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch { /* */ }
      audioContextRef.current = null;
    }

    // Tell server to stop Deepgram session
    if (socketRef.current) {
      socketRef.current.emit("subtitle_audio_stop");
    }
  }, []);

  // ── Start/stop streaming when call becomes active ──────────────────────────
  useEffect(() => {
    if (callActive && localStream && socket) {
      startStreaming();
    } else {
      stopStreaming();
    }
    return () => {
      stopStreaming();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, localStream, socket]);

  // ── Restart Deepgram when displayLang changes ──────────────────────────────
  useEffect(() => {
    if (callActive && localStream && socket && streamingRef.current) {
      stopStreaming();
      const t = setTimeout(() => startStreaming(), 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayLang]);

  // ── Receive transcription results from server → translate → show ───────────
  useEffect(() => {
    if (!socket) return;

    const onReceived = (data: {
      text: string;
      speakerId: string;
      username: string;
      isFinal: boolean;
      lang?: string;
    }) => {
      console.log("[SUBTITLES] Received:", data.text?.substring(0, 50), "isFinal:", data.isFinal, "show:", shouldShowRef.current);
      if (!shouldShowRef.current) return;

      const sourceLang = data.lang || speechLangRef.current;
      const targetLang = displayLangRef.current;

      // If text is from ourselves, show directly without translation
      if (data.speakerId === localSpeakerIdRef.current) {
        upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
        return;
      }

      // Check if translation is needed
      const needsTranslation =
        toLangCode(sourceLang) !== toLangCode(targetLang);

      if (!needsTranslation) {
        upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
        return;
      }

      if (data.isFinal) {
        // Final — always translate via DeepL backend
        translateText(data.text, sourceLang, targetLang).then((translated) => {
          upsertSubtitle(data.speakerId, data.username, translated, true);
        });
      } else {
        // Interim — show original immediately, translate with debounce
        upsertSubtitle(data.speakerId, data.username, data.text, false);

        if (interimTranslateTimerRef.current) {
          clearTimeout(interimTranslateTimerRef.current);
        }
        interimTranslateTimerRef.current = setTimeout(() => {
          translateText(data.text, sourceLang, targetLang).then(
            (translated) => {
              if (translated !== data.text) {
                upsertSubtitle(
                  data.speakerId,
                  data.username,
                  translated,
                  false
                );
              }
            }
          );
        }, 600);
      }
    };

    socket.on("subtitle_received", onReceived);
    return () => {
      socket.off("subtitle_received", onReceived);
      if (interimTranslateTimerRef.current) {
        clearTimeout(interimTranslateTimerRef.current);
        interimTranslateTimerRef.current = null;
      }
    };
  }, [socket, upsertSubtitle]);

  // Clear on disable
  useEffect(() => {
    if (!shouldShow) setSubtitles([]);
  }, [shouldShow]);

  const setLanguage = useCallback((_lang: string) => {}, []);
  const toggleSubtitles = useCallback(() => {}, []);

  return { subtitles, isListening, error, setLanguage, toggleSubtitles };
}
