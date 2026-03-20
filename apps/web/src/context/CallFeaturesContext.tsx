/**
 * CallFeaturesContext
 *
 * Unifies live subtitles and predictive network quality state for the
 * active call into a single React context.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useCall } from "./CallContext";
import { useAuth } from "./AuthContext";
import { usePredictiveQuality } from "../hooks/usePredictiveQuality";
import type { UsePredictiveQualityResult } from "../hooks/usePredictiveQuality";

// ─── Public types ─────────────────────────────────────────────────────────────

export type CallScenario = "group" | "p2p" | "none";

export interface CallFeaturesContextValue {
  /** Which call type is currently active */
  scenario: CallScenario;

  /** Display names for all participants in the active call */
  participantNames: Map<string, string>;

  // ── Network quality ────────────────────────────────────────────────────────
  networkQuality: UsePredictiveQualityResult;

  // ── Subtitles UI state ────────────────────────────────────────────────────
  subtitlesEnabled: boolean;
  /** Language the remote person speaks — translation source */
  speechLang: string;
  /** Language to translate INTO — the user's native language */
  displayLang: string;
  subtitleLang: string; // alias for displayLang
  toggleSubtitles: () => void;
  setSpeechLang: (lang: string) => void;
  setDisplayLang: (lang: string) => void;
  setSubtitleLang: (lang: string) => void; // alias

  // ── Subtitle routing helpers ──────────────────────────────────────────────
  /** For 1-on-1: numeric userId of the remote participant */
  remoteParticipantUserId: number | null;
  /** For group call: chatId */
  groupChatId: number | null;
  /** speakerId string for local user */
  localSpeakerId: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CallFeaturesContext = createContext<CallFeaturesContextValue | null>(null);

export function useCallFeatures(): CallFeaturesContextValue {
  const ctx = useContext(CallFeaturesContext);
  if (!ctx) throw new Error("useCallFeatures must be used within CallFeaturesProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CallFeaturesProvider({ children }: { children: React.ReactNode }) {
  const {
    callState,
    groupCallState,
    callerData,
    groupCallParticipants,
    groupCallChatId,
    p2pPeerConnection,
  } = useCall();
  const { currentUser } = useAuth();

  // ── Determine active scenario ──────────────────────────────────────────────
  const scenario: CallScenario =
    groupCallState === "active" ? "group"
    : callState === "connected"  ? "p2p"
    : "none";

  // ── Network quality (p2p only) ─────────────────────────────────────────────
  const p2pVideoSender =
    scenario === "p2p" && p2pPeerConnection
      ? (p2pPeerConnection.getSenders().find((s) => s.track?.kind === "video") ?? null)
      : null;

  const networkQuality = usePredictiveQuality({
    pc: scenario === "p2p" ? p2pPeerConnection : null,
    videoSender: p2pVideoSender,
  });

  // ── Participant names ──────────────────────────────────────────────────────
  const participantNames = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    m.set("local", currentUser?.username ?? "Вы");
    if (scenario === "group") {
      groupCallParticipants.forEach((p) => m.set(String(p.userId), p.username));
    } else if (scenario === "p2p") {
      const remoteId = callerData ? String(callerData.id) : "remote";
      m.set(remoteId, callerData?.name ?? "Собеседник");
    }
    return m;
  }, [scenario, currentUser, groupCallParticipants, callerData]);

  // ── Subtitles UI state ──────────────────────────────────────────────────────
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  // Use browser language for speech recognition so it matches what the user actually speaks
  const browserLang = navigator.language || "ru-RU";
  const [speechLang, setSpeechLangState] = useState(browserLang);
  const [displayLang, setDisplayLangState] = useState(browserLang);

  const toggleSubtitles = useCallback(() => setSubtitlesEnabled((v) => !v), []);
  const setSpeechLang   = useCallback((l: string) => setSpeechLangState(l), []);
  const setDisplayLang  = useCallback((l: string) => setDisplayLangState(l), []);
  const setSubtitleLang = useCallback((l: string) => setDisplayLangState(l), []);

  // ── Subtitle routing helpers ───────────────────────────────────────────────
  const remoteParticipantUserId: number | null =
    scenario === "p2p" && callerData ? callerData.id : null;
  const localSpeakerId = currentUser ? String(currentUser.id) : "local";

  // ── Context value ──────────────────────────────────────────────────────────
  const value = useMemo<CallFeaturesContextValue>(
    () => ({
      scenario,
      participantNames,
      networkQuality,
      subtitlesEnabled,
      speechLang,
      displayLang,
      subtitleLang: displayLang,
      toggleSubtitles,
      setSpeechLang,
      setDisplayLang,
      setSubtitleLang,
      remoteParticipantUserId,
      groupChatId: groupCallChatId ?? null,
      localSpeakerId,
    }),
    [
      scenario,
      participantNames,
      networkQuality,
      subtitlesEnabled,
      speechLang,
      displayLang,
      toggleSubtitles,
      setSpeechLang,
      setDisplayLang,
      setSubtitleLang,
      remoteParticipantUserId,
      groupCallChatId,
      localSpeakerId,
    ]
  );

  return (
    <CallFeaturesContext.Provider value={value}>
      {children}
    </CallFeaturesContext.Provider>
  );
}
