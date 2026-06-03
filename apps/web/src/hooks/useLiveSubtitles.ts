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
  /**
   * Tolerance mode — activated by predictive quality module when network
   * degradation is detected. Doubles the AudioWorklet buffer size (fewer,
   * larger chunks → less socket overhead) and increases translation debounce
   * to reduce unnecessary API calls during unstable conditions.
   */
  toleranceMode?: boolean;
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
    this._buf = [];
    this._size = 0;
    this._target = 4096; // ~256ms at 16kHz; overridable via port message
    this._sourceOffset = 0;
    this.port.onmessage = (e) => {
      if (e.data?.type === 'set_target') this._target = e.data.value;
    };
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    const ratio = sampleRate / 16000;
    const out = [];
    let pos = this._sourceOffset;
    while (pos < ch.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const a = ch[i] ?? 0;
      const b = ch[Math.min(i + 1, ch.length - 1)] ?? a;
      out.push(a + (b - a) * frac);
      pos += ratio;
    }
    this._sourceOffset = pos - ch.length;

    const pcm = new Int16Array(out.length);
    for (let i = 0; i < out.length; i++) {
      const s = Math.max(-1, Math.min(1, out[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this._buf.push(pcm);
    this._size += pcm.length;
    if (this._size >= this._target) {
      const out = new Int16Array(this._size);
      let off = 0;
      for (const c of this._buf) { out.set(c, off); off += c.length; }
      this.port.postMessage(out.buffer, [out.buffer]);
      this._buf = [];
      this._size = 0;
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

let _workletBlobUrl: string | null = null;
function getWorkletUrl(): string {
  if (!_workletBlobUrl) {
    _workletBlobUrl = URL.createObjectURL(
      new Blob([WORKLET_CODE], { type: "application/javascript" })
    );
  }
  return _workletBlobUrl;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// Buffer sizes for normal and tolerance modes
const WORKLET_TARGET_NORMAL    = 4096;  // ~256ms at 16kHz
const WORKLET_TARGET_TOLERANCE = 8192;  // ~512ms — fewer chunks, less overhead
const DEBOUNCE_NORMAL          = 900;   // ms — interim translation debounce
const DEBOUNCE_TOLERANCE       = 1600;  // ms — slower polling when network is stressed
const MIN_INTERIM_UPDATE_MS    = 160;
const MIN_INTERIM_TRANSLATE_CHARS = 12;
const DEBUG_SUBTITLES = process.env.REACT_APP_DEBUG_SUBTITLES === "true";

const subtitleDebug = (...args: unknown[]) => {
  if (DEBUG_SUBTITLES) console.log(...args);
};

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
  toleranceMode = false,
}: UseLiveSubtitlesOptions): UseLiveSubtitlesResult {
  const shouldShow = showSubtitles ?? enabled ?? false;

  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Always-current refs (no stale closures) ───────────────────────────────
  const refs = useRef({
    shouldShow,
    speechLang,
    displayLang,
    socket,
    remoteUserId,
    groupChatId,
    localUsername,
    localSpeakerId,
    toleranceMode,
  });
  refs.current = { shouldShow, speechLang, displayLang, socket, remoteUserId, groupChatId, localUsername, localSpeakerId, toleranceMode };

  // ─── Audio pipeline state ─────────────────────────────────────────────────
  // We use a ref-object so start/stop can always access the latest handles
  const pipeline = useRef<{
    audioCtx: AudioContext | null;
    worklet: AudioWorkletNode | null;
    source: MediaStreamAudioSourceNode | null;
    silentGain: GainNode | null;
    active: boolean;
  }>({ audioCtx: null, worklet: null, source: null, silentGain: null, active: false });

  const interimTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const translationSeqRef = useRef<Map<string, number>>(new Map());
  const lastInterimUpdateRef = useRef<Map<string, number>>(new Map());
  const latestInterimTextRef = useRef<Map<string, string>>(new Map());

  const clearInterimTimer = useCallback((speakerId: string) => {
    const timer = interimTimersRef.current.get(speakerId);
    if (timer) clearTimeout(timer);
    interimTimersRef.current.delete(speakerId);
  }, []);

  const clearAllInterimTimers = useCallback(() => {
    interimTimersRef.current.forEach((timer) => clearTimeout(timer));
    interimTimersRef.current.clear();
  }, []);

  const nextTranslationSeq = useCallback((speakerId: string) => {
    const next = (translationSeqRef.current.get(speakerId) ?? 0) + 1;
    translationSeqRef.current.set(speakerId, next);
    return next;
  }, []);

  const invalidatePendingTranslations = useCallback(() => {
    translationSeqRef.current.forEach((seq, speakerId) => {
      translationSeqRef.current.set(speakerId, seq + 1);
    });
  }, []);

  // ─── Tolerance mode: adjust worklet buffer size on-the-fly ───────────────
  useEffect(() => {
    const worklet = pipeline.current.worklet;
    if (!worklet) return;
    const target = toleranceMode ? WORKLET_TARGET_TOLERANCE : WORKLET_TARGET_NORMAL;
    worklet.port.postMessage({ type: "set_target", value: target });
    subtitleDebug(`[SUBTITLES] toleranceMode=${toleranceMode} → worklet target=${target}`);
  }, [toleranceMode]);

  // ─── Subtitle upsert ──────────────────────────────────────────────────────
  const upsertSubtitle = useCallback(
    (
      speakerId: string,
      speakerName: string,
      text: string,
      isFinal: boolean,
      options?: { replaceRecentFinal?: boolean }
    ) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      const now = Date.now();

      if (!isFinal) {
        const lastText = latestInterimTextRef.current.get(speakerId);
        const lastAt = lastInterimUpdateRef.current.get(speakerId) ?? 0;
        if (lastText === cleanText) return;
        if (now - lastAt < MIN_INTERIM_UPDATE_MS && cleanText.length <= (lastText?.length ?? 0) + 4) {
          return;
        }
        latestInterimTextRef.current.set(speakerId, cleanText);
        lastInterimUpdateRef.current.set(speakerId, now);
      } else {
        latestInterimTextRef.current.delete(speakerId);
        lastInterimUpdateRef.current.delete(speakerId);
        clearInterimTimer(speakerId);
      }

      setSubtitles((prev) => {
        if (isFinal && options?.replaceRecentFinal) {
          for (let i = prev.length - 1; i >= 0; i--) {
            const entry = prev[i];
            if (entry.speakerId === speakerId && entry.isFinal && now - entry.timestamp < 5000) {
              if (entry.text === cleanText) return prev;
              const updated = [...prev];
              updated[i] = { ...entry, speakerName, text: cleanText, timestamp: now };
              return updated;
            }
          }
        }

        // Find last non-final entry for this speaker
        let interimIdx = -1;
        if (!isFinal) {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].speakerId === speakerId && !prev[i].isFinal) {
              interimIdx = i;
              break;
            }
          }
        }

        if (!isFinal && interimIdx !== -1) {
          // Update existing interim in place
          const updated = [...prev];
          updated[interimIdx] = { ...updated[interimIdx], text: cleanText, timestamp: now };
          return updated;
        }

        // For final: remove any pending interim for this speaker first
        const base = isFinal
          ? prev.filter((s) => !(s.speakerId === speakerId && !s.isFinal))
          : prev;

        const next = [
          ...base,
          { id: uid(), speakerId, speakerName, text: cleanText, isFinal, timestamp: now },
        ];
        return next.length > 30 ? next.slice(-30) : next;
      });
    },
    [clearInterimTimer]
  );

  // ─── Teardown audio pipeline (no guard — always safe to call) ─────────────
  const teardown = useCallback(() => {
    const p = pipeline.current;
    clearAllInterimTimers();
    invalidatePendingTranslations();
    if (!p.active) return;
    p.active = false;

    try { p.worklet?.disconnect(); } catch { /**/ }
    try { p.source?.disconnect(); } catch { /**/ }
    try { p.silentGain?.disconnect(); } catch { /**/ }
    try { p.audioCtx?.close(); } catch { /**/ }

    p.worklet = null;
    p.source = null;
    p.silentGain = null;
    p.audioCtx = null;

    setIsListening(false);
    subtitleDebug("[SUBTITLES] pipeline torn down");
  }, [clearAllInterimTimers, invalidatePendingTranslations]);

  // ─── Send subtitle_audio_stop to server ──────────────────────────────────
  const stopOnServer = useCallback(() => {
    refs.current.socket?.emit("subtitle_audio_stop");
  }, []);

  // ─── Full stop (pipeline + server) ───────────────────────────────────────
  const stop = useCallback(() => {
    teardown();
    stopOnServer();
  }, [teardown, stopOnServer]);

  // ─── Start pipeline + notify server ──────────────────────────────────────
  const start = useCallback(async (stream: MediaStream, sock: Socket) => {
    // Ensure any previous session is fully cleaned up first
    teardown();
    stopOnServer();

    const { displayLang: lang, remoteUserId: to, groupChatId: chatId, localUsername: uname } = refs.current;

    const payload: Record<string, any> = { lang, username: uname };
    if (to) payload.to = to;
    else if (chatId) payload.chatId = chatId;

    try {
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      await audioCtx.audioWorklet.addModule(getWorkletUrl());

      const source = audioCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioCtx, "pcm-processor");
      const silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;

      let chunkN = 0;
      worklet.port.onmessage = (ev: MessageEvent) => {
        const p = pipeline.current;
        if (!p.active) return;
        const activeSocket = refs.current.socket;
        if (!activeSocket?.connected) return;
        activeSocket.emit("subtitle_audio_chunk", ev.data);
        if (++chunkN <= 3) subtitleDebug(`[SUBTITLES] chunk #${chunkN} ${ev.data.byteLength}B`);
      };

      source.connect(worklet);
      worklet.connect(silentGain);
      silentGain.connect(audioCtx.destination);

      pipeline.current = { audioCtx, worklet, source, silentGain, active: true };
      subtitleDebug("[SUBTITLES] → subtitle_audio_start", payload);
      sock.emit("subtitle_audio_start", payload);
      setIsListening(true);
      setError(null);
      subtitleDebug("[SUBTITLES] pipeline started, lang:", lang);
    } catch (err: any) {
      console.error("[SUBTITLES] pipeline start failed:", err);
      // Server session was already started — stop it
      sock.emit("subtitle_audio_stop");
      setError("Не удалось запустить захват аудио");
    }
  }, [teardown, stopOnServer]);

  // ─── Master effect: start/stop when call active/inactive ─────────────────
  useEffect(() => {
    if (shouldShow && callActive && localStream && socket) {
      start(localStream, socket);
    } else {
      stop();
    }
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow, callActive, localStream, socket]);

  // ─── Restart when recognition language (displayLang) changes ─────────────
  // Only restart if already streaming
  useEffect(() => {
    if (!pipeline.current.active) return;
    if (!localStream || !refs.current.socket) return;

    subtitleDebug("[SUBTITLES] displayLang changed →", displayLang, "— restarting");
    // Use a short delay to let React settle any concurrent state updates
    const t = setTimeout(() => {
      if (localStream && refs.current.socket) {
        start(localStream, refs.current.socket);
      }
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayLang]);

  // ─── Sync routing when remoteUserId/groupChatId become available ──────────
  // Handles case where start() ran before callerData was loaded
  useEffect(() => {
    if (!pipeline.current.active || !refs.current.socket) return;

    const payload: Record<string, any> = {
      lang: refs.current.displayLang,
      username: refs.current.localUsername,
    };
    if (remoteUserId) payload.to = remoteUserId;
    else if (groupChatId) payload.chatId = groupChatId;

    subtitleDebug("[SUBTITLES] → subtitle_session_update", payload);
    refs.current.socket.emit("subtitle_session_update", payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUserId, groupChatId]);

  // ─── Receive subtitles from server, translate, display ────────────────────
  useEffect(() => {
    if (!socket) return;

    const onReceived = (data: {
      text: string;
      speakerId: string;
      username: string;
      isFinal: boolean;
      lang?: string;
    }) => {
      const { shouldShow, speechLang, displayLang, localSpeakerId } = refs.current;

      subtitleDebug(
        `[SUBTITLES] ← subtitle_received "${data.text?.slice(0, 50)}"`,
        `final:${data.isFinal} show:${shouldShow} speaker:${data.speakerId} me:${localSpeakerId}`
      );

      if (!shouldShow) return;

      const isMe = data.speakerId === localSpeakerId;

      // Own speech: show as-is (we already know the language)
      if (isMe) {
        upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
        return;
      }

      // Remote speech: translate from their lang → our display lang
      const from = data.lang || speechLang;
      const to   = displayLang;

      if (toLangCode(from) === toLangCode(to)) {
        // Same language — no translation needed
        upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
        return;
      }

      if (data.isFinal) {
        const seq = nextTranslationSeq(data.speakerId);
        clearInterimTimer(data.speakerId);
        upsertSubtitle(data.speakerId, data.username, data.text, true);
        translateText(data.text, from, to).then((translated) => {
          if (!refs.current.shouldShow) return;
          if (translationSeqRef.current.get(data.speakerId) !== seq) return;
          if (translated !== data.text) {
            upsertSubtitle(data.speakerId, data.username, translated, true, { replaceRecentFinal: true });
          }
        });
      } else {
        // Show original instantly, replace with translation after debounce
        upsertSubtitle(data.speakerId, data.username, data.text, false);

        clearInterimTimer(data.speakerId);
        if (data.text.trim().length < MIN_INTERIM_TRANSLATE_CHARS) return;

        const debounceMs = refs.current.toleranceMode ? DEBOUNCE_TOLERANCE : DEBOUNCE_NORMAL;
        const seq = nextTranslationSeq(data.speakerId);
        const timer = setTimeout(() => {
          translateText(data.text, from, to).then((translated) => {
            if (!refs.current.shouldShow) return;
            if (translationSeqRef.current.get(data.speakerId) !== seq) return;
            if (translated !== data.text) {
              upsertSubtitle(data.speakerId, data.username, translated, false);
            }
          });
        }, debounceMs);
        interimTimersRef.current.set(data.speakerId, timer);
      }
    };

    const onError = (data?: { message?: string }) => {
      setError(data?.message || "Subtitles are unavailable");
      teardown();
    };

    socket.on("subtitle_received", onReceived);
    socket.on("subtitle_error", onError);
    return () => {
      socket.off("subtitle_received", onReceived);
      socket.off("subtitle_error", onError);
      clearAllInterimTimers();
    };
  }, [socket, upsertSubtitle, teardown, clearAllInterimTimers, clearInterimTimer, nextTranslationSeq]);

  // ─── Clear subtitles when disabled ───────────────────────────────────────
  useEffect(() => {
    if (!shouldShow) {
      clearAllInterimTimers();
      invalidatePendingTranslations();
      setSubtitles([]);
    }
  }, [shouldShow, clearAllInterimTimers, invalidatePendingTranslations]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = useCallback((_: string) => {}, []);
  const toggleSubtitles = useCallback(() => {}, []);

  return { subtitles, isListening, error, setLanguage, toggleSubtitles };
}
