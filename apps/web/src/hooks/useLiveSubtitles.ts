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
    this._buf = [];
    this._size = 0;
    this._target = 4096; // ~256ms at 16kHz
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    const ratio = Math.round(sampleRate / 16000) || 3;
    const ds = new Float32Array(Math.ceil(ch.length / ratio));
    for (let i = 0, j = 0; i < ch.length; i += ratio, j++) ds[j] = ch[i];
    const pcm = new Int16Array(ds.length);
    for (let i = 0; i < ds.length; i++) {
      const s = Math.max(-1, Math.min(1, ds[i]));
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
  });
  refs.current = { shouldShow, speechLang, displayLang, socket, remoteUserId, groupChatId, localUsername, localSpeakerId };

  // ─── Audio pipeline state ─────────────────────────────────────────────────
  // We use a ref-object so start/stop can always access the latest handles
  const pipeline = useRef<{
    audioCtx: AudioContext | null;
    worklet: AudioWorkletNode | null;
    source: MediaStreamAudioSourceNode | null;
    silentGain: GainNode | null;
    active: boolean;
  }>({ audioCtx: null, worklet: null, source: null, silentGain: null, active: false });

  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Subtitle upsert ──────────────────────────────────────────────────────
  const upsertSubtitle = useCallback(
    (speakerId: string, speakerName: string, text: string, isFinal: boolean) => {
      setSubtitles((prev) => {
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
          updated[interimIdx] = { ...updated[interimIdx], text, timestamp: Date.now() };
          return updated;
        }

        // For final: remove any pending interim for this speaker first
        const base = isFinal
          ? prev.filter((s) => !(s.speakerId === speakerId && !s.isFinal))
          : prev;

        const next = [
          ...base,
          { id: uid(), speakerId, speakerName, text, isFinal, timestamp: Date.now() },
        ];
        return next.length > 30 ? next.slice(-30) : next;
      });
    },
    []
  );

  // ─── Teardown audio pipeline (no guard — always safe to call) ─────────────
  const teardown = useCallback(() => {
    const p = pipeline.current;
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
    console.log("[SUBTITLES] pipeline torn down");
  }, []);

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

    console.log("[SUBTITLES] → subtitle_audio_start", payload);
    sock.emit("subtitle_audio_start", payload);

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
        refs.current.socket?.emit("subtitle_audio_chunk", ev.data);
        if (++chunkN <= 3) console.log(`[SUBTITLES] chunk #${chunkN} ${ev.data.byteLength}B`);
      };

      source.connect(worklet);
      worklet.connect(silentGain);
      silentGain.connect(audioCtx.destination);

      pipeline.current = { audioCtx, worklet, source, silentGain, active: true };
      setIsListening(true);
      setError(null);
      console.log("[SUBTITLES] pipeline started, lang:", lang);
    } catch (err: any) {
      console.error("[SUBTITLES] pipeline start failed:", err);
      // Server session was already started — stop it
      sock.emit("subtitle_audio_stop");
      setError("Не удалось запустить захват аудио");
    }
  }, [teardown, stopOnServer]);

  // ─── Master effect: start/stop when call active/inactive ─────────────────
  useEffect(() => {
    if (callActive && localStream && socket) {
      start(localStream, socket);
    } else {
      stop();
    }
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, localStream, socket]);

  // ─── Restart when recognition language (displayLang) changes ─────────────
  // Only restart if already streaming
  useEffect(() => {
    if (!pipeline.current.active) return;
    if (!localStream || !refs.current.socket) return;

    console.log("[SUBTITLES] displayLang changed →", displayLang, "— restarting");
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

    console.log("[SUBTITLES] → subtitle_session_update", payload);
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

      console.log(
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
        translateText(data.text, from, to).then((translated) =>
          upsertSubtitle(data.speakerId, data.username, translated, true)
        );
      } else {
        // Show original instantly, replace with translation after debounce
        upsertSubtitle(data.speakerId, data.username, data.text, false);

        if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
        interimTimerRef.current = setTimeout(() => {
          translateText(data.text, from, to).then((translated) => {
            if (translated !== data.text) {
              upsertSubtitle(data.speakerId, data.username, translated, false);
            }
          });
        }, 500);
      }
    };

    socket.on("subtitle_received", onReceived);
    return () => {
      socket.off("subtitle_received", onReceived);
      if (interimTimerRef.current) {
        clearTimeout(interimTimerRef.current);
        interimTimerRef.current = null;
      }
    };
  }, [socket, upsertSubtitle]);

  // ─── Clear subtitles when disabled ───────────────────────────────────────
  useEffect(() => {
    if (!shouldShow) setSubtitles([]);
  }, [shouldShow]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = useCallback((_: string) => {}, []);
  const toggleSubtitles = useCallback(() => {}, []);

  return { subtitles, isListening, error, setLanguage, toggleSubtitles };
}
