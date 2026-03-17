import { useState, useEffect, useRef, useCallback } from "react";

// ─── Ambient type declarations for Web Speech API ────────────────────────────
// TypeScript 4.9.5 / lib.dom doesn't ship full SpeechRecognition types.

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface Subtitle {
  text: string;
  isFinal: boolean;
  timestamp: number;
  /** "local" for own voice, participantId string for remotes */
  speakerId: string;
}

export interface StreamDescriptor {
  participantId: string;
  stream: MediaStream;
}

export interface UseLiveSubtitlesOptions {
  localStream: MediaStream | null;
  remoteStreams?: StreamDescriptor[];
  /** BCP-47 language tag, e.g. "ru-RU", "en-US". Default: "ru-RU" */
  lang?: string;
}

export interface UseLiveSubtitlesResult {
  subtitles: Subtitle[];
  isListening: boolean;
  error: string | null;
  setLanguage: (lang: string) => void;
  toggleSubtitles: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBTITLE_BUFFER_SIZE = 50;
const AUTO_RESTART_ERRORS = new Set(["network", "no-speech", "audio-capture"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function addSubtitle(
  prev: Subtitle[],
  next: Subtitle,
  speakerId: string
): Subtitle[] {
  // Replace the last interim entry for the same speaker; append finals.
  let updated: Subtitle[];

  if (!next.isFinal) {
    let lastIdx = -1;
    for (let i = prev.length - 1; i >= 0; i--) {
      if (prev[i].speakerId === speakerId && !prev[i].isFinal) {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx !== -1) {
      updated = [
        ...prev.slice(0, lastIdx),
        next,
        ...prev.slice(lastIdx + 1),
      ];
    } else {
      updated = [...prev, next];
    }
  } else {
    // Drop any interim for this speaker and append final
    updated = [
      ...prev.filter((s) => !(s.speakerId === speakerId && !s.isFinal)),
      next,
    ];
  }

  // Cap to SUBTITLE_BUFFER_SIZE (drop oldest)
  if (updated.length > SUBTITLE_BUFFER_SIZE) {
    updated = updated.slice(updated.length - SUBTITLE_BUFFER_SIZE);
  }
  return updated;
}

// ─── Recognition instance manager ────────────────────────────────────────────

interface RecognitionEntry {
  recognition: ISpeechRecognition;
  speakerId: string;
  active: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useLiveSubtitles
 *
 * Uses the Web Speech API (SpeechRecognition / webkitSpeechRecognition) to
 * produce live subtitle entries for call participants.
 *
 * IMPORTANT BROWSER LIMITATION:
 *   The Web Speech API always captures from the device microphone — it cannot
 *   directly consume an arbitrary MediaStream. Therefore:
 *   - Local voice is transcribed from the actual microphone input (one instance).
 *   - Remote streams are accepted in the API surface for future compatibility
 *     (e.g., when browser vendors add MediaStream source support), but currently
 *     each remote StreamDescriptor spawns its own SpeechRecognition instance
 *     that will also transcribe from the microphone. Label it clearly in UI.
 *   - If you need true remote transcription, route it through a server-side STT
 *     service instead.
 */
export function useLiveSubtitles(
  options: UseLiveSubtitlesOptions
): UseLiveSubtitlesResult {
  const { localStream, remoteStreams = [], lang: initialLang = "ru-RU" } = options;

  // ── State ──────────────────────────────────────────────────────────────────
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLangState] = useState(initialLang);
  const [enabled, setEnabled] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  /** All active recognition entries, keyed by speakerId */
  const entriesRef = useRef<Map<string, RecognitionEntry>>(new Map());
  const enabledRef = useRef(false);
  const langRef = useRef(lang);

  // Keep refs in sync with state
  enabledRef.current = enabled;
  langRef.current = lang;

  // ── Check browser support ──────────────────────────────────────────────────
  const Ctor = getSpeechRecognitionCtor();
  const isSupported = Ctor !== null;

  // ── Build / start a single recognition instance ───────────────────────────
  const createEntry = useCallback(
    (speakerId: string): RecognitionEntry | null => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return null;

      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langRef.current;
      recognition.maxAlternatives = 1;

      const entry: RecognitionEntry = { recognition, speakerId, active: false };

      recognition.onstart = () => {
        entry.active = true;
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? "";
          if (!transcript.trim()) continue;

          const subtitle: Subtitle = {
            text: transcript.trim(),
            isFinal: result.isFinal,
            timestamp: Date.now(),
            speakerId,
          };
          setSubtitles((prev) => addSubtitle(prev, subtitle, speakerId));
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errCode = event.error;

        if (errCode === "not-allowed" || errCode === "service-not-allowed") {
          setError("Доступ к микрофону запрещён для распознавания речи.");
          setEnabled(false);
          enabledRef.current = false;
          return;
        }

        if (AUTO_RESTART_ERRORS.has(errCode)) {
          // Will be restarted by onend
          return;
        }

        setError(`Ошибка распознавания речи: ${errCode}`);
      };

      recognition.onend = () => {
        entry.active = false;
        // Auto-restart if still enabled
        if (enabledRef.current) {
          try {
            recognition.lang = langRef.current;
            recognition.start();
          } catch {
            // Already started or destroyed — ignore
          }
        } else {
          // Check if any entry is still active
          let anyActive = false;
          entriesRef.current.forEach((e) => {
            if (e.active) anyActive = true;
          });
          if (!anyActive) setIsListening(false);
        }
      };

      return entry;
    },
    [] // stable — reads only refs
  );

  // ── Start all recognitions ─────────────────────────────────────────────────
  const startAll = useCallback(() => {
    const entries = entriesRef.current;

    // Build desired speaker set: always "local" + one per remote stream
    const desiredIds = new Set<string>(["local"]);
    remoteStreams.forEach((sd) => desiredIds.add(sd.participantId));

    // Remove stale entries
    entries.forEach((entry, id) => {
      if (!desiredIds.has(id)) {
        try { entry.recognition.abort(); } catch { /* ignore */ }
        entries.delete(id);
      }
    });

    // Add missing entries and start them
    desiredIds.forEach((speakerId) => {
      if (!entries.has(speakerId)) {
        const entry = createEntry(speakerId);
        if (entry) entries.set(speakerId, entry);
      }
      const entry = entries.get(speakerId);
      if (entry && !entry.active) {
        try {
          entry.recognition.lang = langRef.current;
          entry.recognition.start();
        } catch {
          // May already be running
        }
      }
    });
  }, [remoteStreams, createEntry]);

  // ── Stop all recognitions ──────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    entriesRef.current.forEach((entry) => {
      try { entry.recognition.abort(); } catch { /* ignore */ }
      entry.active = false;
    });
    entriesRef.current.clear();
    setIsListening(false);
  }, []);

  // ── Effect: start/stop based on enabled + localStream ─────────────────────
  useEffect(() => {
    if (!isSupported) {
      setError(
        "Web Speech API не поддерживается в этом браузере. " +
        "Попробуйте Google Chrome или Microsoft Edge."
      );
      return;
    }

    if (enabled && localStream) {
      setError(null);
      startAll();
    } else {
      stopAll();
    }

    return () => {
      // Cleanup when dependencies change — full stop; startAll re-runs if still enabled
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, localStream, isSupported]);

  // ── Effect: sync language to running recognitions ─────────────────────────
  useEffect(() => {
    langRef.current = lang;
    if (enabled) {
      // Restart to apply new language
      stopAll();
      if (localStream) startAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ── Effect: update remote stream set when it changes ──────────────────────
  useEffect(() => {
    if (enabled && localStream) {
      startAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStreams]);

  // ── Public API ─────────────────────────────────────────────────────────────
  const setLanguage = useCallback((newLang: string) => {
    setLangState(newLang);
  }, []);

  const toggleSubtitles = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      enabledRef.current = next;
      if (!next) {
        // Clear interim entries on disable
        setSubtitles((subs) => subs.filter((s) => s.isFinal));
      }
      return next;
    });
  }, []);

  return {
    subtitles,
    isListening,
    error: isSupported ? error : "Web Speech API не поддерживается в этом браузере.",
    setLanguage,
    toggleSubtitles,
  };
}
