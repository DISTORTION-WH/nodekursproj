import React, { useEffect, useRef, useCallback } from "react";
import { useCall } from "../context/CallContext";
import { GroupCallParticipant } from "../types";
import { useAuth } from "../context/AuthContext";
import { SpeakingIndicator } from "./TalkTimeFairnessPanel";
import TalkTimeFairnessPanel from "./TalkTimeFairnessPanel";
import SubtitlesOverlay, { CCButton, SubtitleLangSelect } from "./SubtitlesOverlay";
import NetworkQualityIndicator from "./NetworkQualityIndicator";
import { CallFeaturesProvider, useCallFeatures } from "../context/CallFeaturesContext";

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

// ─── Inner content (reads from CallFeaturesContext + CallContext) ─────────────

function CallOverlayContent() {
  const {
    callState, isVideoCall, localStream, remoteStream, callerData,
    answerCall, endCall, muteAudio, muteVideo, isAudioMuted, isVideoMuted,
    groupCallState, groupCallParticipants, groupCallIsVideo,
    leaveGroupCall, muteGroupAudio, muteGroupVideo, isGroupAudioMuted, isGroupVideoMuted,
    incomingGroupCall, dismissGroupCallBanner, joinGroupCall,
  } = useCall();

  const { currentUser } = useAuth();

  const {
    speakingState,
    participantCount,
    subtitlesEnabled,
    subtitleLang,
    toggleSubtitles,
    setSubtitleLang,
    fairnessPanelVisible,
    toggleFairnessPanel,
  } = useCallFeatures();

  // ─── Video refs ──────────────────────────────────────────────────────────
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
    }
  }, [localStream, callState]);

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

  const showBanner =
    incomingGroupCall !== null && groupCallState === "idle" && callState === "idle";

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
            <NetworkQualityIndicator />
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
                    voiceState={speakingState.get("local")}
                    participantCount={participantCount}
                  />
                  {groupCallParticipants.map((p) => (
                    <ParticipantTile
                      key={p.userId}
                      participant={p}
                      voiceState={speakingState.get(String(p.userId))}
                      participantCount={participantCount}
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
              onClick={toggleFairnessPanel}
              active={fairnessPanelVisible}
              title={fairnessPanelVisible ? "Скрыть статистику речи" : "Показать статистику речи"}
            >
              📊
            </ControlBtn>
            {/* Subtitles */}
            <CCButton active={subtitlesEnabled} onToggle={toggleSubtitles} />
            {subtitlesEnabled && (
              <SubtitleLangSelect value={subtitleLang} onChange={setSubtitleLang} />
            )}
            <ControlBtn onClick={leaveGroupCall} danger title="Покинуть звонок">
              📞
            </ControlBtn>
          </div>

          {/* Fairness panel */}
          {fairnessPanelVisible && <TalkTimeFairnessPanel defaultCollapsed={false} />}

          {/* Subtitles overlay */}
          <SubtitlesOverlay
            localStream={localStream}
            remoteStreams={groupCallParticipants
              .filter((p) => p.stream !== null)
              .map((p) => ({
                participantId: String(p.userId),
                stream: p.stream as MediaStream,
              }))}
            callActive
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
                  <NetworkQualityIndicator />
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
                      {speakingState.get(remoteParticipantId)?.isSpeaking && (
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

              {/* Control bar */}
              <div className="flex items-center justify-center gap-4 p-4 bg-discord-secondary">
                <ControlBtn onClick={muteAudio} active={isAudioMuted} title="Микрофон">
                  {isAudioMuted ? "🔇" : "🎤"}
                </ControlBtn>
                {isVideoCall && (
                  <ControlBtn onClick={muteVideo} active={isVideoMuted} title="Камера">
                    {isVideoMuted ? "🚫" : "📷"}
                  </ControlBtn>
                )}
                {/* Fairness panel toggle */}
                <ControlBtn
                  onClick={toggleFairnessPanel}
                  active={fairnessPanelVisible}
                  title={fairnessPanelVisible ? "Скрыть статистику речи" : "Показать статистику речи"}
                >
                  📊
                </ControlBtn>
                {/* Subtitles */}
                <CCButton active={subtitlesEnabled} onToggle={toggleSubtitles} />
                {subtitlesEnabled && (
                  <SubtitleLangSelect value={subtitleLang} onChange={setSubtitleLang} />
                )}
                <ControlBtn onClick={endCall} danger title="Завершить">
                  📞
                </ControlBtn>
              </div>

              {/* Fairness panel */}
              {fairnessPanelVisible && <TalkTimeFairnessPanel defaultCollapsed={false} />}

              {/* Subtitles overlay */}
              <SubtitlesOverlay
                localStream={localStream}
                remoteStreams={
                  remoteStream
                    ? [{ participantId: remoteParticipantId, stream: remoteStream }]
                    : []
                }
                callActive
                bottomOffset={76}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export default function CallOverlay() {
  return (
    <CallFeaturesProvider>
      <CallOverlayContent />
    </CallFeaturesProvider>
  );
}
