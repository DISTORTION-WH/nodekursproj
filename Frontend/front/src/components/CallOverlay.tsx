import React, { useEffect, useRef, useState, useCallback } from "react";
import { useCall } from "../context/CallContext";
import { GroupCallParticipant } from "../types";
import { useAuth } from "../context/AuthContext";
import { useVoiceActivity } from "../hooks/useVoiceActivity";
import type { VoiceActivityResult, StreamDescriptor } from "../hooks/useVoiceActivity";
import TalkTimeFairnessPanel, { SpeakingIndicator } from "./TalkTimeFairnessPanel";
import SubtitlesOverlay, { CCButton, SubtitleLangSelect } from "./SubtitlesOverlay";
import NetworkQualityIndicator from "./NetworkQualityIndicator";
import { usePredictiveQuality } from "../hooks/usePredictiveQuality";
import { saveCallAnalytics } from "../services/api";

// ─── Participant tile for group call ────────────────────────────────────────

interface ParticipantTileProps {
  participant: GroupCallParticipant;
  isLocal?: boolean;
  voiceState?: { isSpeaking: boolean; talkPercent: number };
  participantCount: number;
}

function ParticipantTile({
  participant,
  isLocal = false,
  voiceState,
  participantCount,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initial = participant.username ? participant.username[0].toUpperCase() : "?";
  const hasVideo = participant.stream
    ? participant.stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live")
    : false;

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const isSpeaking = voiceState?.isSpeaking ?? false;

  return (
    <div
      className={[
        "relative bg-discord-tertiary rounded-xl overflow-hidden",
        "flex items-center justify-center aspect-video",
        "transition-shadow duration-200",
        isSpeaking ? "ring-2 ring-[#3ba55d] ring-offset-2 ring-offset-discord-bg" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-discord-accent flex items-center justify-center text-white text-2xl font-bold">
            {initial}
          </div>
        </div>
      )}

      {/* Name label with speaking indicator */}
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5">
        {voiceState && (
          <SpeakingIndicator
            isSpeaking={voiceState.isSpeaking}
            talkPercent={voiceState.talkPercent}
            participantCount={participantCount}
            size="sm"
          />
        )}
        {isLocal ? "Вы" : participant.username}
        {participant.audioMuted && <span>🔇</span>}
      </div>
    </div>
  );
}

// ─── VoiceActivity bridge ────────────────────────────────────────────────────
// Reads the ref-based VoiceActivityResult at 200ms intervals and exposes a
// reactive snapshot so ParticipantTile ring highlights update in real time.

function useReactiveVoiceState(
  voiceActivity: VoiceActivityResult
): Map<string, { isSpeaking: boolean; talkPercent: number }> {
  const [snapshot, setSnapshot] = useState<
    Map<string, { isSpeaking: boolean; talkPercent: number }>
  >(new Map());

  useEffect(() => {
    const id = setInterval(() => {
      const next = new Map<string, { isSpeaking: boolean; talkPercent: number }>();
      voiceActivity.participants.forEach((s, id) => {
        next.set(id, { isSpeaking: s.isSpeaking, talkPercent: s.talkPercent });
      });
      setSnapshot(next);
    }, 200);
    return () => clearInterval(id);
    // voiceActivity is a stable ref — intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return snapshot;
}

// ─── Analytics submission helper ─────────────────────────────────────────────

function buildAnalyticsPayload(
  voiceActivity: VoiceActivityResult,
  startedAt: Date,
  localUserId: number,
  participantUserIds: Map<string, number> // participantId → userId
) {
  const endedAt = new Date();

  const participants = Array.from(voiceActivity.participants.entries())
    .map(([pid, state]) => {
      // "local" maps to the caller's own userId; others use the Map
      const userId =
        pid === "local" ? localUserId : (participantUserIds.get(pid) ?? parseInt(pid, 10));

      const interruptionsMade = voiceActivity.interruptions.filter(
        (e) => e.interrupter === pid
      ).length;
      const interruptionsReceived = voiceActivity.interruptions.filter(
        (e) => e.interrupted === pid
      ).length;

      return {
        userId,
        talkTimeSeconds: state.talkTime,
        talkPercent: state.talkPercent,
        interruptionsMade,
        interruptionsReceived,
        avgAudioLevel: state.audioLevel,
      };
    });

  const interruptions = voiceActivity.interruptions.map((ev) => {
    const interrupterUserId =
      ev.interrupter === "local"
        ? localUserId
        : (participantUserIds.get(ev.interrupter) ?? parseInt(ev.interrupter, 10));
    const interruptedUserId =
      ev.interrupted === "local"
        ? localUserId
        : (participantUserIds.get(ev.interrupted) ?? parseInt(ev.interrupted, 10));
    return {
      interrupterUserId,
      interruptedUserId,
      occurredAt: new Date(ev.timestamp).toISOString(),
    };
  });

  return {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    participantCount: participants.length,
    fairnessIndex: voiceActivity.fairnessIndex,
    participants,
    interruptions,
  };
}

// ─── Main overlay component ──────────────────────────────────────────────────

export default function CallOverlay() {
  const {
    callState, isVideoCall, localStream, remoteStream, callerData,
    answerCall, endCall, muteAudio, muteVideo, isAudioMuted, isVideoMuted,
    groupCallState, groupCallParticipants, groupCallIsVideo,
    leaveGroupCall, muteGroupAudio, muteGroupVideo, isGroupAudioMuted, isGroupVideoMuted,
    incomingGroupCall, dismissGroupCallBanner, joinGroupCall,
    p2pPeerConnection,
  } = useCall();

  const { currentUser } = useAuth();

  // ─── Panel & subtitles visibility ───────────────────────────────────────
  const [showFairnessPanel, setShowFairnessPanel] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [subtitleLang, setSubtitleLang] = useState("ru-RU");

  // Reset panel visibility when a new group call starts
  useEffect(() => {
    if (groupCallState === "active") setShowFairnessPanel(true);
  }, [groupCallState]);

  // ─── Call start timestamps (for analytics duration) ──────────────────────
  const groupCallStartedAtRef = useRef<Date | null>(null);
  const p2pCallStartedAtRef   = useRef<Date | null>(null);

  // Track group call start
  useEffect(() => {
    if (groupCallState === "active" && !groupCallStartedAtRef.current) {
      groupCallStartedAtRef.current = new Date();
    }
    if (groupCallState === "idle") {
      groupCallStartedAtRef.current = null;
    }
  }, [groupCallState]);

  // Track p2p call connected
  useEffect(() => {
    if (callState === "connected" && !p2pCallStartedAtRef.current) {
      p2pCallStartedAtRef.current = new Date();
    }
    if (callState === "idle") {
      p2pCallStartedAtRef.current = null;
    }
  }, [callState]);

  // ─── Voice activity — group call ─────────────────────────────────────────
  // Build stream descriptors; kept stable-ish via useMemo equivalent inline.
  // groupCallParticipants is a React state array → changes trigger re-render
  // which rebuilds this array; useVoiceActivity handles stream changes via
  // its own effect (re-creates AnalyserNode only when track id changes).
  const groupStreams: StreamDescriptor[] = [
    { participantId: "local", stream: groupCallState === "active" ? localStream : null },
    ...groupCallParticipants.map((p) => ({
      participantId: String(p.userId),
      stream: p.stream,
    })),
  ];

  const groupVoiceActivity = useVoiceActivity({
    streams: groupCallState === "active" ? groupStreams : [],
  });

  // ─── Voice activity — 1-on-1 call ────────────────────────────────────────
  const p2pStreams: StreamDescriptor[] = [
    { participantId: "local", stream: callState === "connected" ? localStream : null },
    {
      participantId: callerData ? String(callerData.id) : "remote",
      stream: callState === "connected" ? remoteStream : null,
    },
  ];

  const p2pVoiceActivity = useVoiceActivity({
    streams: callState === "connected" ? p2pStreams : [],
  });

  // ─── Network quality prediction (1-on-1 only) ────────────────────────────
  const p2pVideoSender =
    callState === "connected" && p2pPeerConnection
      ? (p2pPeerConnection.getSenders().find(
          (s) => s.track?.kind === "video"
        ) ?? null)
      : null;

  const networkQuality = usePredictiveQuality({
    pc: callState === "connected" ? p2pPeerConnection : null,
    videoSender: p2pVideoSender,
  });

  // ─── Analytics: submit on call end ───────────────────────────────────────
  // We capture a snapshot of the voice data just before state resets to idle.
  // The useEffect below fires after render when state becomes idle; voice
  // activity refs still hold the last computed values at that point.

  // Stable ref to participant userId map for group calls (updated each render)
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
      const voiceSnap = groupVoiceActivity;
      const userIdsMap = new Map(groupParticipantUserIdsRef.current);
      // Fire-and-forget; do not block UI
      saveCallAnalytics(
        buildAnalyticsPayload(voiceSnap, startedAt, currentUser.id, userIdsMap)
      ).catch(() => { /* silent — analytics are non-critical */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupCallState]);

  const prevCallStateRef = useRef(callState);
  useEffect(() => {
    const wasConnected = prevCallStateRef.current === "connected";
    prevCallStateRef.current = callState;

    if (wasConnected && callState === "idle" && currentUser && p2pCallStartedAtRef.current) {
      const startedAt = p2pCallStartedAtRef.current;
      const voiceSnap = p2pVoiceActivity;
      const remoteId = callerData ? String(callerData.id) : "remote";
      const userIdsMap = new Map<string, number>();
      if (callerData) userIdsMap.set(remoteId, callerData.id);
      saveCallAnalytics(
        buildAnalyticsPayload(voiceSnap, startedAt, currentUser.id, userIdsMap)
      ).catch(() => { /* silent */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  // ─── Participant names maps ───────────────────────────────────────────────
  const groupParticipantNames = new Map<string, string>([
    ["local", currentUser?.username ?? "Вы"],
    ...groupCallParticipants.map(
      (p) => [String(p.userId), p.username] as [string, string]
    ),
  ]);

  const p2pParticipantNames = new Map<string, string>([
    ["local", currentUser?.username ?? "Вы"],
    [
      callerData ? String(callerData.id) : "remote",
      callerData?.name ?? "Собеседник",
    ],
  ]);

  // ─── Reactive speaking state for tile highlights ──────────────────────────
  const groupSpeakingState = useReactiveVoiceState(groupVoiceActivity);
  const p2pSpeakingState   = useReactiveVoiceState(p2pVoiceActivity);

  // ─── Video refs ──────────────────────────────────────────────────────────
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // 1-on-1: attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
    }
  }, [localStream, callState]);

  // 1-on-1: attach remote stream
  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.onloadedmetadata = () =>
          remoteVideoRef.current?.play().catch(console.error);
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.onloadedmetadata = () =>
          remoteAudioRef.current?.play().catch(console.error);
      }
    }
  }, [remoteStream, isVideoCall]);

  // ─── Shared control button ────────────────────────────────────────────────
  const ControlBtn = useCallback(({
    onClick, active, danger, children, title,
  }: {
    onClick: () => void; active?: boolean; danger?: boolean;
    children: React.ReactNode; title?: string;
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition ${
        danger
          ? "bg-discord-danger hover:bg-discord-danger-hover text-white"
          : active
          ? "bg-discord-input-hover text-white"
          : "bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary hover:text-white"
      }`}
    >
      {children}
    </button>
  ), []);

  const callerInitial = callerData?.name ? callerData.name[0].toUpperCase() : "?";
  const AvatarPlaceholder = ({ size = "w-20 h-20" }: { size?: string }) => (
    <div className={`${size} rounded-full bg-discord-accent flex items-center justify-center text-white text-3xl font-bold`}>
      {callerInitial}
    </div>
  );

  // ─── Incoming group call banner ──────────────────────────────────────────
  const showBanner =
    incomingGroupCall !== null && groupCallState === "idle" && callState === "idle";

  // Derived: total participants for SpeakingIndicator fairShare calculation
  const groupParticipantCount = groupCallParticipants.length + 1; // +1 for local
  const p2pParticipantCount   = 2;

  // p2p remote participant id key
  const remoteParticipantId = callerData ? String(callerData.id) : "remote";

  return (
    <>
      {/* Incoming group call banner */}
      {showBanner && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-discord-secondary border border-discord-accent/30 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 z-[60] animate-pulse">
          <span className="text-discord-text-primary text-sm">
            🔔{" "}
            <span className="font-semibold">
              {incomingGroupCall!.startedBy.username}
            </span>{" "}
            начал(а) звонок
          </span>
          <button
            onClick={() => joinGroupCall(incomingGroupCall!.chatId, false)}
            className="bg-discord-success hover:bg-discord-success-hover text-white text-xs px-3 py-1 rounded-full transition"
          >
            Присоединиться
          </button>
          <button
            onClick={dismissGroupCallBanner}
            className="text-discord-text-muted hover:text-discord-text-primary text-sm transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Group call overlay ─── */}
      {groupCallState === "active" && (
        <div className="fixed inset-0 bg-discord-bg z-50 flex flex-col relative">
          {/* Network quality indicator — top-left */}
          <div className="absolute top-3 left-3 z-20">
            <NetworkQualityIndicator
              metrics={networkQuality.metrics}
              prediction={networkQuality.prediction}
              currentBitrate={networkQuality.currentBitrate}
              isAdapting={networkQuality.isAdapting}
            />
          </div>

          {/* Participant grid */}
          <div className="flex-1 overflow-auto p-4">
            {(() => {
              const localParticipant: GroupCallParticipant = {
                userId: currentUser?.id ?? 0,
                username: currentUser?.username ?? "Вы",
                stream: localStream,
                audioMuted: isGroupAudioMuted,
                videoMuted: isGroupVideoMuted,
              };
              const allParticipants = [localParticipant, ...groupCallParticipants];
              const cols = Math.min(allParticipants.length, 3);
              return (
                <div
                  className="grid gap-2 h-full"
                  style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                >
                  <ParticipantTile
                    key={`local-${localParticipant.userId}`}
                    participant={localParticipant}
                    isLocal
                    voiceState={groupSpeakingState.get("local")}
                    participantCount={groupParticipantCount}
                  />
                  {groupCallParticipants.map((p) => (
                    <ParticipantTile
                      key={p.userId}
                      participant={p}
                      voiceState={groupSpeakingState.get(String(p.userId))}
                      participantCount={groupParticipantCount}
                    />
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Control bar */}
          <div className="shrink-0 bg-discord-secondary border-t border-white/10 px-6 py-4 flex items-center justify-center gap-4">
            <ControlBtn onClick={muteGroupAudio} active={isGroupAudioMuted} title="Микрофон">
              {isGroupAudioMuted ? "🔇" : "🎤"}
            </ControlBtn>
            {groupCallIsVideo && (
              <ControlBtn onClick={muteGroupVideo} active={isGroupVideoMuted} title="Камера">
                {isGroupVideoMuted ? "🚫" : "📷"}
              </ControlBtn>
            )}
            {/* Fairness panel toggle */}
            <ControlBtn
              onClick={() => setShowFairnessPanel((v) => !v)}
              active={showFairnessPanel}
              title={showFairnessPanel ? "Скрыть статистику речи" : "Показать статистику речи"}
            >
              📊
            </ControlBtn>
            {/* Subtitles */}
            <CCButton active={showSubtitles} onToggle={() => setShowSubtitles((v) => !v)} />
            {showSubtitles && (
              <SubtitleLangSelect value={subtitleLang} onChange={setSubtitleLang} />
            )}
            <ControlBtn onClick={leaveGroupCall} danger title="Покинуть звонок">
              📞
            </ControlBtn>
          </div>

          {/* Fairness panel — only when toggled on and call is active */}
          {showFairnessPanel && (
            <TalkTimeFairnessPanel
              voiceActivity={groupVoiceActivity}
              participantNames={groupParticipantNames}
              defaultCollapsed={false}
            />
          )}

          {/* Subtitles overlay — sits above the control bar (88px), below grid */}
          <SubtitlesOverlay
            localStream={localStream}
            remoteStreams={groupCallParticipants.map((p) => ({
              participantId: String(p.userId),
              stream: p.stream,
            }))}
            participantNames={groupParticipantNames}
            callActive
            enabled={showSubtitles}
            lang={subtitleLang}
            bottomOffset={88}
          />
        </div>
      )}

      {/* ─── 1-on-1 call overlay ─── */}
      {callState !== "idle" && groupCallState === "idle" && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50">
          {callState === "connected" && (
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          )}

          {/* Incoming call */}
          {callState === "incoming" && (
            <div className="bg-discord-secondary rounded-2xl p-10 flex flex-col items-center gap-4 shadow-2xl animate-pulse">
              <AvatarPlaceholder />
              <h3 className="text-white text-xl font-semibold">{callerData?.name}</h3>
              <p className="text-discord-text-muted text-sm">
                {isVideoCall ? "Входящий видеозвонок..." : "Входящий аудиозвонок..."}
              </p>
              <div className="flex gap-4 mt-2">
                <ControlBtn onClick={endCall} danger title="Отклонить">
                  📵
                </ControlBtn>
                <ControlBtn onClick={answerCall} title="Принять">
                  <span className="text-discord-success text-xl">📞</span>
                </ControlBtn>
              </div>
            </div>
          )}

          {/* Calling */}
          {callState === "calling" && (
            <div className="bg-discord-secondary rounded-2xl p-10 flex flex-col items-center gap-4 shadow-2xl">
              {isVideoCall && localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-40 h-24 rounded-xl object-cover -scale-x-100"
                />
              ) : (
                <AvatarPlaceholder />
              )}
              <h3 className="text-white text-xl font-semibold">Звонок...</h3>
              <div className="flex gap-4 mt-2">
                <ControlBtn onClick={endCall} danger title="Отмена">
                  📵
                </ControlBtn>
              </div>
            </div>
          )}

          {/* Connected */}
          {callState === "connected" && (
            <div
              className="relative bg-discord-secondary rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              style={{ width: isVideoCall ? 640 : 360, maxWidth: "95vw" }}
            >
              <div
                className="relative bg-discord-tertiary flex items-center justify-center"
                style={{ height: isVideoCall ? 360 : 200 }}
              >
                {/* Network quality indicator — top-left of video area */}
                <div className="absolute top-2 left-2 z-10">
                  <NetworkQualityIndicator
                    metrics={networkQuality.metrics}
                    prediction={networkQuality.prediction}
                    currentBitrate={networkQuality.currentBitrate}
                    isAdapting={networkQuality.isAdapting}
                  />
                </div>

                {isVideoCall ? (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain -scale-x-100"
                    />
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="absolute bottom-3 right-3 w-32 h-20 rounded-xl object-cover border-2 border-discord-accent -scale-x-100"
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    {/* Remote speaking indicator for audio-only 1-on-1 */}
                    <div className="relative">
                      <AvatarPlaceholder size="w-24 h-24" />
                      {p2pSpeakingState.get(remoteParticipantId)?.isSpeaking && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#3ba55d] animate-pulse border-2 border-discord-secondary" />
                      )}
                    </div>
                    <h3 className="text-white text-lg font-semibold">
                      {callerData?.name}
                    </h3>
                    <p className="text-discord-text-muted text-sm">Идет разговор...</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-4 p-4 bg-discord-secondary">
                <ControlBtn onClick={muteAudio} active={isAudioMuted} title="Микрофон">
                  {isAudioMuted ? "🔇" : "🎤"}
                </ControlBtn>
                {isVideoCall && (
                  <ControlBtn onClick={muteVideo} active={isVideoMuted} title="Камера">
                    {isVideoMuted ? "🚫" : "📷"}
                  </ControlBtn>
                )}
                {/* Fairness panel toggle for 1-on-1 */}
                <ControlBtn
                  onClick={() => setShowFairnessPanel((v) => !v)}
                  active={showFairnessPanel}
                  title={showFairnessPanel ? "Скрыть статистику речи" : "Показать статистику речи"}
                >
                  📊
                </ControlBtn>
                {/* Subtitles */}
                <CCButton active={showSubtitles} onToggle={() => setShowSubtitles((v) => !v)} />
                {showSubtitles && (
                  <SubtitleLangSelect value={subtitleLang} onChange={setSubtitleLang} />
                )}
                <ControlBtn onClick={endCall} danger title="Завершить">
                  📞
                </ControlBtn>
              </div>

              {/* Fairness panel for 1-on-1 — positioned inside the card */}
              {showFairnessPanel && (
                <TalkTimeFairnessPanel
                  voiceActivity={p2pVoiceActivity}
                  participantNames={p2pParticipantNames}
                  defaultCollapsed={false}
                />
              )}

              {/* Subtitles overlay — above the control bar inside the card */}
              <SubtitlesOverlay
                localStream={localStream}
                remoteStreams={
                  remoteStream
                    ? [{ participantId: callerData ? String(callerData.id) : "remote", stream: remoteStream }]
                    : []
                }
                participantNames={p2pParticipantNames}
                callActive
                enabled={showSubtitles}
                lang={subtitleLang}
                bottomOffset={76}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
