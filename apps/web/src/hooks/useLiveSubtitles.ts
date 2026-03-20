import { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { translateText, toLangCode } from "./useTranslate";

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

// ─── Throttle helper for socket emit ─────────────────────────────────────────

const THROTTLE_MS = 333;

interface ThrottleState {
  lastEmitTime: number;
  pendingInterim: string | null;
  throttleTimer: ReturnType<typeof setTimeout> | null;
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

  // ── Double-buffering refs (Step 2) ────────────────────────────────────────
  const activeRecRef = useRef<ISpeechRecognition | null>(null);
  const standbyRecRef = useRef<ISpeechRecognition | null>(null);
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

  // ── Heartbeat refs (Step 2b) ──────────────────────────────────────────────
  const lastResultTimestampRef = useRef<number>(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Throttle state (Step 3) ───────────────────────────────────────────────
  const throttleRef = useRef<ThrottleState>({
    lastEmitTime: 0,
    pendingInterim: null,
    throttleTimer: null,
  });

  // ── Interim translation debounce (Step 6) ─────────────────────────────────
  const interimTranslateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Throttled socket emit (Step 3) ─────────────────────────────────────────
  const emitSubtitle = useCallback((text: string, isFinal: boolean) => {
    if (!socketRef.current) return;

    const payload = {
      text,
      speakerId: localSpeakerIdRef.current,
      username: localUsernameRef.current,
      isFinal,
      lang: displayLangRef.current, // Step 4: язык на котором я говорю
    };

    const dest = remoteUserIdRef.current
      ? { to: remoteUserIdRef.current }
      : groupChatIdRef.current
      ? { chatId: groupChatIdRef.current }
      : null;

    if (!dest) return;

    const emit = () => {
      socketRef.current?.emit("subtitle_broadcast", { ...payload, ...dest });
    };

    const ts = throttleRef.current;

    if (isFinal) {
      // Final — always send immediately, cancel pending interim
      if (ts.throttleTimer) {
        clearTimeout(ts.throttleTimer);
        ts.throttleTimer = null;
      }
      ts.pendingInterim = null;
      emit();
      return;
    }

    // Interim — throttle to max 3/sec
    const now = Date.now();
    if (now - ts.lastEmitTime >= THROTTLE_MS) {
      emit();
      ts.lastEmitTime = now;
      ts.pendingInterim = null;
    } else {
      // Save and send later
      ts.pendingInterim = text;
      if (!ts.throttleTimer) {
        ts.throttleTimer = setTimeout(() => {
          if (ts.pendingInterim) {
            const delayedPayload = {
              text: ts.pendingInterim,
              speakerId: localSpeakerIdRef.current,
              username: localUsernameRef.current,
              isFinal: false,
              lang: displayLangRef.current,
            };
            const delayedDest = remoteUserIdRef.current
              ? { to: remoteUserIdRef.current }
              : groupChatIdRef.current
              ? { chatId: groupChatIdRef.current }
              : null;
            if (delayedDest) {
              socketRef.current?.emit("subtitle_broadcast", { ...delayedPayload, ...delayedDest });
            }
            ts.lastEmitTime = Date.now();
            ts.pendingInterim = null;
          }
          ts.throttleTimer = null;
        }, THROTTLE_MS);
      }
    }
  }, []);

  // ── Create a standby SpeechRecognition instance (Step 2a) ──────────────────
  const createRecognitionInstance = useCallback((): ISpeechRecognition | null => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = displayLangRef.current;
    rec.maxAlternatives = 1;
    return rec;
  }, []);

  // ── Wire up event handlers on a recognition instance ──────────────────────
  const wireRecognition = useCallback((rec: ISpeechRecognition) => {
    rec.onstart = () => {
      activeRef.current = true;
      setIsListening(true);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      lastResultTimestampRef.current = Date.now();
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        emitSubtitle(text, result.isFinal);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
      }
      // "aborted" is expected when we intentionally stop.
      // "no-speech", "network", "audio-capture" are transient — onend handles restart.
    };

    rec.onend = () => {
      activeRef.current = false;
      // Only restart if this instance is still the "current" one
      if (activeRecRef.current !== rec) {
        setIsListening(false);
        return;
      }

      // Step 2a: Double-buffering — instantly switch to standby
      activeRecRef.current = null;

      if (standbyRecRef.current) {
        const next = standbyRecRef.current;
        standbyRecRef.current = null;
        activeRecRef.current = next;
        wireRecognition(next);
        try { next.start(); } catch { /* */ }
        // Prepare next standby
        standbyRecRef.current = createRecognitionInstance();
      } else {
        // Fallback: create new instance after short delay
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          startRecognition();
        }, 200);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitSubtitle, createRecognitionInstance]);

  // ── Start recognition with double-buffering ───────────────────────────────
  const startRecognition = useCallback(() => {
    // Clean up previous instances
    if (activeRecRef.current) {
      try { activeRecRef.current.abort(); } catch { /* */ }
      activeRecRef.current = null;
    }
    if (standbyRecRef.current) {
      try { standbyRecRef.current.abort(); } catch { /* */ }
      standbyRecRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    const rec = createRecognitionInstance();
    if (!rec) return;

    activeRecRef.current = rec;
    wireRecognition(rec);

    // Prepare standby
    standbyRecRef.current = createRecognitionInstance();

    lastResultTimestampRef.current = Date.now();
    try { rec.start(); } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRecognitionInstance, wireRecognition]);

  const stopRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    // Stop active
    const rec = activeRecRef.current;
    activeRecRef.current = null; // signal onend not to restart
    if (rec) { try { rec.abort(); } catch { /* */ } }
    // Stop standby
    const standby = standbyRecRef.current;
    standbyRecRef.current = null;
    if (standby) { try { standby.abort(); } catch { /* */ } }
    // Clean throttle
    if (throttleRef.current.throttleTimer) {
      clearTimeout(throttleRef.current.throttleTimer);
      throttleRef.current.throttleTimer = null;
    }
    activeRef.current = false;
    setIsListening(false);
  }, []);

  // ── ALWAYS start recognition when a call is active ─────────────────────────
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
  useEffect(() => {
    if (callActive && localStream && isSupported) {
      stopRecognition();
      const t = setTimeout(() => startRecognition(), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayLang]);

  // ── Step 2b: Heartbeat — restart if no results for 45s ────────────────────
  useEffect(() => {
    if (!callActive || !localStream || !isSupported) return;

    heartbeatTimerRef.current = setInterval(() => {
      if (!activeRecRef.current) return;
      const elapsed = Date.now() - lastResultTimestampRef.current;
      if (elapsed > 45000) {
        // Force restart — recognition may have silently died
        stopRecognition();
        startRecognition();
      }
    }, 15000);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, localStream]);

  // ── Step 1+4+6: Receive remote subtitles → translate → show ───────────────
  useEffect(() => {
    if (!socket) return;

    const onReceived = (data: { text: string; speakerId: string; username: string; isFinal: boolean; lang?: string }) => {
      if (!shouldShowRef.current) return;

      const sourceLang = data.lang || speechLangRef.current;
      const targetLang = displayLangRef.current;

      // Check if translation is needed
      const needsTranslation = toLangCode(sourceLang) !== toLangCode(targetLang);

      if (!needsTranslation) {
        upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
        return;
      }

      if (data.isFinal) {
        // Final — always translate
        translateText(data.text, sourceLang, targetLang).then((translated) => {
          upsertSubtitle(data.speakerId, data.username, translated, true);
        });
      } else {
        // Interim — show original immediately, then translate with debounce (Step 6)
        upsertSubtitle(data.speakerId, data.username, data.text, false);

        if (interimTranslateTimerRef.current) {
          clearTimeout(interimTranslateTimerRef.current);
        }
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
