/**
 * CallFeaturesContext
 *
 * Unifies voice activity, live subtitles, and predictive network quality
 * state for the active call into a single React context.
 *
 * Provider reads streams and connections from CallContext (useCall), runs
 * the three feature hooks, and exposes combined data + UI toggle state to
 * all call UI subcomponents.
 *
 * Only one call scenario can be active at a time (group OR p2p), so the
 * provider runs a single set of hooks driven by the active scenario's streams.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCall } from "./CallContext";
import { useAuth } from "./AuthContext";
import { useVoiceActivity } from "../hooks/useVoiceActivity";
import type { VoiceActivityResult, StreamDescriptor } from "../hooks/useVoiceActivity";
import { usePredictiveQuality } from "../hooks/usePredictiveQuality";
import type { UsePredictiveQualityResult } from "../hooks/usePredictiveQuality";
import { saveCallAnalytics } from "../services/api";

// ─── Analytics helper (moved from CallOverlay) ────────────────────────────────

function buildAnalyticsPayload(
  voiceActivity: VoiceActivityResult,
  startedAt: Date,
  localUserId: number,
  participantUserIds: Map<string, number>
) {
  const endedAt = new Date();

  const participants = Array.from(voiceActivity.participants.entries()).map(
    ([pid, state]) => {
      const userId =
        pid === "local"
          ? localUserId
          : participantUserIds.get(pid) ?? parseInt(pid, 10);
      return {
        userId,
        talkTimeSeconds: state.talkTime,
        talkPercent: state.talkPercent,
        interruptionsMade: voiceActivity.interruptions.filter((e) => e.interrupter === pid).length,
        interruptionsReceived: voiceActivity.interruptions.filter((e) => e.interrupted === pid).length,
        avgAudioLevel: state.audioLevel,
      };
    }
  );

  const interruptions = voiceActivity.interruptions.map((ev) => ({
    interrupterUserId:
      ev.interrupter === "local"
        ? localUserId
        : participantUserIds.get(ev.interrupter) ?? parseInt(ev.interrupter, 10),
    interruptedUserId:
      ev.interrupted === "local"
        ? localUserId
        : participantUserIds.get(ev.interrupted) ?? parseInt(ev.interrupted, 10),
    occurredAt: new Date(ev.timestamp).toISOString(),
  }));

  return {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    participantCount: participants.length,
    fairnessIndex: voiceActivity.fairnessIndex,
    participants,
    interruptions,
  };
}

// ─── Internal bridge: makes the stable voice-activity ref reactive ────────────

function useReactiveVoiceState(
  voiceActivity: VoiceActivityResult
): Map<string, { isSpeaking: boolean; talkPercent: number }> {
  const [snapshot, setSnapshot] = useState<
    Map<string, { isSpeaking: boolean; talkPercent: number }>
  >(new Map());

  useEffect(() => {
    const id = setInterval(() => {
      const next = new Map<string, { isSpeaking: boolean; talkPercent: number }>();
      voiceActivity.participants.forEach((s, pid) => {
        next.set(pid, { isSpeaking: s.isSpeaking, talkPercent: s.talkPercent });
      });
      setSnapshot(next);
    }, 200);
    return () => clearInterval(id);
    // voiceActivity is a stable ref — intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return snapshot;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type CallScenario = "group" | "p2p" | "none";

export interface CallFeaturesContextValue {
  /** Which call type is currently active */
  scenario: CallScenario;

  // ── Voice activity ─────────────────────────────────────────────────────────
  /** Stable-ref result from useVoiceActivity — read directly for non-reactive access */
  voiceActivity: VoiceActivityResult;
  /**
   * Reactive snapshot of speaking state, updated every 200ms.
   * Key: participantId ("local" or String(userId)).
   */
  speakingState: Map<string, { isSpeaking: boolean; talkPercent: number }>;
  /** Display names for all participants in the active call */
  participantNames: Map<string, string>;
  /** Total participant count (including local user) */
  participantCount: number;

  // ── Network quality ────────────────────────────────────────────────────────
  /** Full network quality result from usePredictiveQuality */
  networkQuality: UsePredictiveQualityResult;

  // ── Subtitles UI state ────────────────────────────────────────────────────
  subtitlesEnabled: boolean;
  subtitleLang: string;
  toggleSubtitles: () => void;
  setSubtitleLang: (lang: string) => void;

  // ── Fairness panel UI state ───────────────────────────────────────────────
  fairnessPanelVisible: boolean;
  toggleFairnessPanel: () => void;
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
    localStream,
    remoteStream,
    callerData,
    groupCallParticipants,
    p2pPeerConnection,
  } = useCall();
  const { currentUser } = useAuth();

  // ── Determine active scenario ──────────────────────────────────────────────
  const scenario: CallScenario =
    groupCallState === "active" ? "group"
    : callState === "connected"  ? "p2p"
    : "none";

  // ── Stream descriptors for the active scenario ─────────────────────────────
  const groupStreams: StreamDescriptor[] = useMemo(
    () => [
      { participantId: "local", stream: groupCallState === "active" ? localStream : null },
      ...groupCallParticipants.map((p) => ({
        participantId: String(p.userId),
        stream: p.stream,
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupCallState, localStream, groupCallParticipants]
  );

  const p2pStreams: StreamDescriptor[] = useMemo(
    () => [
      { participantId: "local", stream: callState === "connected" ? localStream : null },
      {
        participantId: callerData ? String(callerData.id) : "remote",
        stream: callState === "connected" ? remoteStream : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callState, localStream, remoteStream, callerData]
  );

  const activeStreams =
    scenario === "group" ? groupStreams
    : scenario === "p2p"  ? p2pStreams
    : [];

  // ── Voice activity (single instance, switches scenarios) ──────────────────
  const voiceActivity = useVoiceActivity({
    streams: activeStreams,
  });

  const speakingState = useReactiveVoiceState(voiceActivity);

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

  const participantCount =
    scenario === "group" ? groupCallParticipants.length + 1 : 2;

  // ── UI toggle state ────────────────────────────────────────────────────────
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitleLang, setSubtitleLangState] = useState("ru-RU");
  const [fairnessPanelVisible, setFairnessPanelVisible] = useState(true);

  // Reset fairness panel when group call starts
  useEffect(() => {
    if (groupCallState === "active") setFairnessPanelVisible(true);
  }, [groupCallState]);

  const toggleSubtitles   = useCallback(() => setSubtitlesEnabled((v) => !v), []);
  const setSubtitleLang   = useCallback((l: string) => setSubtitleLangState(l), []);
  const toggleFairnessPanel = useCallback(() => setFairnessPanelVisible((v) => !v), []);

  // ── Analytics: submit on call end ─────────────────────────────────────────
  const groupCallStartedAtRef = useRef<Date | null>(null);
  const p2pCallStartedAtRef   = useRef<Date | null>(null);

  useEffect(() => {
    if (groupCallState === "active" && !groupCallStartedAtRef.current) {
      groupCallStartedAtRef.current = new Date();
    }
    if (groupCallState === "idle") groupCallStartedAtRef.current = null;
  }, [groupCallState]);

  useEffect(() => {
    if (callState === "connected" && !p2pCallStartedAtRef.current) {
      p2pCallStartedAtRef.current = new Date();
    }
    if (callState === "idle") p2pCallStartedAtRef.current = null;
  }, [callState]);

  const groupParticipantUserIdsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const m = new Map<string, number>();
    groupCallParticipants.forEach((p) => m.set(String(p.userId), p.userId));
    groupParticipantUserIdsRef.current = m;
  }, [groupCallParticipants]);

  const prevGroupCallStateRef = useRef(groupCallState);
  useEffect(() => {
    const wasActive = prevGroupCallStateRef.current === "active";
    prevGroupCallStateRef.current = groupCallState;
    if (wasActive && groupCallState === "idle" && currentUser && groupCallStartedAtRef.current) {
      const startedAt = groupCallStartedAtRef.current;
      const userIdsMap = new Map(groupParticipantUserIdsRef.current);
      saveCallAnalytics(
        buildAnalyticsPayload(voiceActivity, startedAt, currentUser.id, userIdsMap)
      ).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupCallState]);

  const prevCallStateRef = useRef(callState);
  useEffect(() => {
    const wasConnected = prevCallStateRef.current === "connected";
    prevCallStateRef.current = callState;
    if (wasConnected && callState === "idle" && currentUser && p2pCallStartedAtRef.current) {
      const startedAt = p2pCallStartedAtRef.current;
      const remoteId = callerData ? String(callerData.id) : "remote";
      const userIdsMap = new Map<string, number>();
      if (callerData) userIdsMap.set(remoteId, callerData.id);
      saveCallAnalytics(
        buildAnalyticsPayload(voiceActivity, startedAt, currentUser.id, userIdsMap)
      ).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  // ── Context value ──────────────────────────────────────────────────────────
  // speakingState changes every 200ms — this is the intentional update cadence.
  const value = useMemo<CallFeaturesContextValue>(
    () => ({
      scenario,
      voiceActivity,
      speakingState,
      participantNames,
      participantCount,
      networkQuality,
      subtitlesEnabled,
      subtitleLang,
      toggleSubtitles,
      setSubtitleLang,
      fairnessPanelVisible,
      toggleFairnessPanel,
    }),
    // voiceActivity is a stable ref — changes not tracked via deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      scenario,
      speakingState,
      participantNames,
      participantCount,
      networkQuality,
      subtitlesEnabled,
      subtitleLang,
      toggleSubtitles,
      setSubtitleLang,
      fairnessPanelVisible,
      toggleFairnessPanel,
    ]
  );

  return (
    <CallFeaturesContext.Provider value={value}>
      {children}
    </CallFeaturesContext.Provider>
  );
}
