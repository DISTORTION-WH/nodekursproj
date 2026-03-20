import { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";

// ─── Web Speech API ambient types ────────────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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
  /**
   * "Язык собеседника" — source language when translating incoming text.
   * The remote person speaks this language.
   */
  speechLang?: string;
  /**
   * "Мой язык" — used for rec.lang (recognize own speech)
   * AND as the target language when translating incoming text.
   */
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

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const activeRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const isSupported = !!getRecognitionCtor();

  // ── Upsert subtitle entry ──────────────────────────────────────────────────
  const upsertSubtitle = useCallback((speakerId: string, speakerName: string, text: string, isFinal: boolean) => {
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

      const entry: Subtitle = { id: uid(), speakerId, speakerName, text, isFinal, timestamp: Date.now() };
      const next = [...base, entry];
      return next.length > 30 ? next.slice(next.length - 30) : next;
    });
  }, []);

  // ── SpeechRecognition ──────────────────────────────────────────────────────
  // Captures LOCAL speech via microphone.
  // rec.lang = displayLang ("Мой язык") — so recognition matches the user's own language.
  // ALWAYS broadcasts recognized text to the remote participant via socket,
  // regardless of whether subtitles are enabled locally — so if only the
  // remote side has subtitles on, they still see our speech.
  // Creates a fresh SpeechRecognition instance and starts it.
  // On any end/error it automatically restarts with a NEW instance after a
  // short delay, which avoids the Chrome bug where restarting the same
  // dead instance silently fails.
  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    // Clean up previous instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* */ }
      recognitionRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = displayLangRef.current;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => { activeRef.current = true; setIsListening(true); };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;

        const isFinal = result.isFinal;

        // Broadcast own speech to remote participant(s) via socket
        if (socketRef.current) {
          const payload = {
            text,
            speakerId: localSpeakerIdRef.current,
            username: localUsernameRef.current,
            isFinal,
          };
          if (remoteUserIdRef.current) {
            socketRef.current.emit("subtitle_broadcast", { ...payload, to: remoteUserIdRef.current });
          } else if (groupChatIdRef.current) {
            socketRef.current.emit("subtitle_broadcast", { ...payload, chatId: groupChatIdRef.current });
          }
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
      }
      // "aborted" is expected when we intentionally stop — don't log it.
      // All other errors (no-speech, network, audio-capture) are transient;
      // onend fires after onerror and will handle the restart.
    };

    rec.onend = () => {
      activeRef.current = false;
      // Only restart if this instance is still the "current" one (i.e. not
      // explicitly stopped via stopRecognition which sets ref to null).
      if (recognitionRef.current !== rec) {
        setIsListening(false);
        return;
      }
      // Create a BRAND NEW instance after a short delay.
      // Re-using the same dead instance is unreliable in Chrome/Edge.
      recognitionRef.current = null;
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        startRecognition();
      }, 300);
    };

    try { rec.start(); } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const rec = recognitionRef.current;
    recognitionRef.current = null; // signal onend not to restart
    if (rec) { try { rec.abort(); } catch { /* */ } }
    activeRef.current = false;
    setIsListening(false);
  }, []);

  // ── ALWAYS start recognition when a call is active ─────────────────────────
  // Both participants always recognize & broadcast their own speech so that
  // subtitles work immediately when either side enables them — no signaling
  // round-trip needed.
  useEffect(() => {
    if (!isSupported) {
      setError("SpeechRecognition не поддерживается. Используйте Chrome или Edge.");
      return;
    }
    if (callActive && localStream) {
      setError(null);
      startRecognition();
    } else {
      stopRecognition();
    }
    return () => { stopRecognition(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, localStream]);

  // Restart recognition when displayLang changes (user changed "Мой язык")
  // because rec.lang needs to match the user's language for accurate recognition
  useEffect(() => {
    if (callActive && localStream && isSupported) {
      stopRecognition();
      const t = setTimeout(() => startRecognition(), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayLang]);

  // ── Receive remote subtitles → show directly ──────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onReceived = (data: { text: string; speakerId: string; username: string; isFinal: boolean }) => {
      if (!shouldShowRef.current) return;
      upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
    };

    socket.on("subtitle_received", onReceived);
    return () => { socket.off("subtitle_received", onReceived); };
  }, [socket, upsertSubtitle]);

  // Clear on disable
  useEffect(() => {
    if (!shouldShow) setSubtitles([]);
  }, [shouldShow]);

  const setLanguage = useCallback((_lang: string) => {}, []);
  const toggleSubtitles = useCallback(() => {}, []);

  return { subtitles, isListening, error, setLanguage, toggleSubtitles };
}
