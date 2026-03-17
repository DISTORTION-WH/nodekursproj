import React, { useEffect, useRef, useState } from "react";
import { useCall } from "../context/CallContext";
import { GroupCallParticipant } from "../types";
import { useAuth } from "../context/AuthContext";
import { SpeakingIndicator } from "./TalkTimeFairnessPanel";
import TalkTimeFairnessPanel from "./TalkTimeFairnessPanel";
import SubtitlesOverlay, { CCButton, SubtitleLangSelect } from "./SubtitlesOverlay";
import NetworkQualityIndicator from "./NetworkQualityIndicator";
import { CallFeaturesProvider, useCallFeatures } from "../context/CallFeaturesContext";

// ─── Control button (standalone component to allow useState hook) ─────────────

interface ControlBtnProps {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
  title?: string;
}

function ControlBtn({ onClick, active, danger, children, title }: ControlBtnProps) {
  const [hovered, setHovered] = useState(false);

  const baseStyle: React.CSSProperties = {
    width: 52,
    height: 52,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    cursor: "pointer",
    border: "none",
    outline: "none",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    transform: hovered ? "scale(1.08)" : "scale(1)",
  };

  const variantStyle: React.CSSProperties = danger
    ? {
        background: "linear-gradient(135deg, #ed4245, #c0392b)",
        boxShadow: hovered
          ? "0 6px 20px rgba(237,66,69,0.55)"
          : "0 4px 16px rgba(237,66,69,0.4)",
        border: "none",
      }
    : active
    ? {
        background: "rgba(237,66,69,0.2)",
        border: "1px solid rgba(237,66,69,0.4)",
        boxShadow: hovered ? "0 0 12px rgba(237,66,69,0.2)" : "none",
      }
    : {
        background: hovered ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: hovered ? "0 0 12px rgba(255,255,255,0.05)" : "none",
      };

  return (
    <button
      onClick={onClick}
      title={title}
      style={{ ...baseStyle, ...variantStyle }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

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
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        aspectRatio: "16/9",
        background: "rgba(15,16,28,0.9)",
        border: isSpeaking
          ? "1px solid rgba(88,101,242,0.6)"
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: isSpeaking
          ? "0 0 20px rgba(88,101,242,0.2), inset 0 0 0 1px rgba(88,101,242,0.3)"
          : "0 4px 16px rgba(0,0,0,0.4)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: isLocal ? "scaleX(-1)" : "none",
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #5865f2, #4752c4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 26,
              fontWeight: 700,
              boxShadow: "0 4px 16px rgba(88,101,242,0.4)",
            }}
          >
            {initial}
          </div>
        </div>
      )}

      {/* Name label with speaking indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(8px)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 500,
          padding: "3px 10px",
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
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

  const callerInitial = callerData?.name ? callerData.name[0].toUpperCase() : "?";

  const AvatarPlaceholder = ({ size = 80 }: { size?: number }) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #5865f2, #4752c4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: size * 0.38,
        fontWeight: 700,
        boxShadow: "0 8px 32px rgba(88,101,242,0.45)",
        flexShrink: 0,
      }}
    >
      {callerInitial}
    </div>
  );

  const showBanner =
    incomingGroupCall !== null && groupCallState === "idle" && callState === "idle";

  const remoteParticipantId = callerData ? String(callerData.id) : "remote";

  // ─── Glassmorphism control bar style ──────────────────────────────────────
  const glassControlBar: React.CSSProperties = {
    flexShrink: 0,
    background: "rgba(20,21,35,0.9)",
    backdropFilter: "blur(20px)",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    padding: "14px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  };

  return (
    <>
      {/* ─── Incoming group call banner ─── */}
      {showBanner && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            background: "rgba(30,31,48,0.98)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            padding: "24px 32px",
            minWidth: 320,
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Pulse ring */}
          <div style={{ position: "relative", marginBottom: 4 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #57f287, #3ba55d)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                boxShadow: "0 4px 20px rgba(87,242,135,0.35)",
              }}
            >
              🔔
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                background: "linear-gradient(135deg, #fff, #a8b4ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginBottom: 4,
              }}
            >
              {incomingGroupCall!.startedBy.username}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 400 }}>
              Входящий групповой звонок
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={() => joinGroupCall(incomingGroupCall!.chatId, false)}
              style={{
                background: "linear-gradient(135deg, #57f287, #3ba55d)",
                border: "none",
                borderRadius: 999,
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                padding: "8px 20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 4px 16px rgba(87,242,135,0.3)",
              }}
            >
              📞 Присоединиться
            </button>
            <button
              onClick={dismissGroupCallBanner}
              style={{
                background: "linear-gradient(135deg, #ed4245, #c0392b)",
                border: "none",
                borderRadius: 999,
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                padding: "8px 16px",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(237,66,69,0.3)",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ─── Group call overlay ─── */}
      {groupCallState === "active" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(135deg, rgba(10,10,20,0.97) 0%, rgba(20,15,40,0.97) 100%)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Header bar */}
          <div
            style={{
              flexShrink: 0,
              background: "rgba(15,16,28,0.85)",
              backdropFilter: "blur(16px)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#57f287",
                  boxShadow: "0 0 8px rgba(87,242,135,0.6)",
                }}
              />
              <span
                style={{
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                Групповой звонок
              </span>
              <span
                style={{
                  background: "rgba(88,101,242,0.2)",
                  border: "1px solid rgba(88,101,242,0.3)",
                  borderRadius: 999,
                  color: "rgba(168,180,255,0.9)",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 10px",
                }}
              >
                {groupCallParticipants.length + 1} участн.
              </span>
            </div>

            {/* Network quality indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <NetworkQualityIndicator />
            </div>
          </div>

          {/* Participant grid */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 16,
            }}
          >
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
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: 10,
                    height: "100%",
                  }}
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
          <div style={glassControlBar}>
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, rgba(10,10,20,0.97) 0%, rgba(20,15,40,0.97) 100%)",
            backdropFilter: "blur(20px)",
          }}
        >
          {callState === "connected" && (
            <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
          )}

          {/* ── Incoming call ── */}
          {callState === "incoming" && (
            <div
              style={{
                background: "rgba(30,31,48,0.98)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 24,
                padding: "40px 48px",
                minWidth: 320,
                textAlign: "center",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
              className="animate-fade-in-up"
            >
              {/* Animated ring around avatar */}
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: -8,
                    borderRadius: "50%",
                    border: "2px solid rgba(88,101,242,0.4)",
                    animation: "pulse-ring 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
                  }}
                />
                <AvatarPlaceholder size={88} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #fff, #a8b4ff)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    marginBottom: 6,
                  }}
                >
                  {callerData?.name}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                  {isVideoCall ? "Входящий видеозвонок..." : "Входящий аудиозвонок..."}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  onClick={endCall}
                  title="Отклонить"
                  style={{
                    background: "linear-gradient(135deg, #ed4245, #c0392b)",
                    border: "none",
                    borderRadius: 999,
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 14,
                    padding: "10px 24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 4px 16px rgba(237,66,69,0.4)",
                  }}
                >
                  📵 Отклонить
                </button>
                <button
                  onClick={answerCall}
                  title="Принять"
                  style={{
                    background: "linear-gradient(135deg, #57f287, #3ba55d)",
                    border: "none",
                    borderRadius: 999,
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 14,
                    padding: "10px 24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 4px 16px rgba(87,242,135,0.4)",
                  }}
                >
                  📞 Принять
                </button>
              </div>
            </div>
          )}

          {/* ── Calling ── */}
          {callState === "calling" && (
            <div
              style={{
                background: "rgba(30,31,48,0.98)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 24,
                padding: "40px 48px",
                minWidth: 320,
                textAlign: "center",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
              className="animate-fade-in-up"
            >
              {isVideoCall && localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: 160,
                    height: 96,
                    borderRadius: 14,
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
              ) : (
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: -8,
                      borderRadius: "50%",
                      border: "2px solid rgba(88,101,242,0.35)",
                      animation: "pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
                    }}
                  />
                  <AvatarPlaceholder size={88} />
                </div>
              )}

              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #fff, #a8b4ff)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    marginBottom: 6,
                  }}
                >
                  {callerData?.name}
                </div>
                <div
                  style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}
                  className="animate-pulse"
                >
                  Звонок...
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <button
                  onClick={endCall}
                  title="Отмена"
                  style={{
                    background: "linear-gradient(135deg, #ed4245, #c0392b)",
                    border: "none",
                    borderRadius: 999,
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 14,
                    padding: "10px 24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 4px 16px rgba(237,66,69,0.4)",
                  }}
                >
                  📵 Отмена
                </button>
              </div>
            </div>
          )}

          {/* ── Connected ── */}
          {callState === "connected" && (
            <div
              style={{
                position: "relative",
                background: "rgba(18,19,32,0.98)",
                borderRadius: 20,
                overflow: "hidden",
                boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
                width: isVideoCall ? 640 : 380,
                maxWidth: "95vw",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              className="animate-fade-in-up"
            >
              {/* Video / audio area */}
              <div
                style={{
                  position: "relative",
                  background: "rgba(10,10,20,0.95)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: isVideoCall ? 360 : 220,
                }}
              >
                {/* Network quality indicator — top-left of video area */}
                <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}>
                  <NetworkQualityIndicator />
                </div>

                {isVideoCall ? (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        transform: "scaleX(-1)",
                      }}
                    />
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{
                        position: "absolute",
                        bottom: 12,
                        right: 12,
                        width: 128,
                        height: 80,
                        borderRadius: 12,
                        objectFit: "cover",
                        transform: "scaleX(-1)",
                        border: "2px solid rgba(88,101,242,0.6)",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                      }}
                    />
                  </>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {/* Remote speaking indicator for audio-only 1-on-1 */}
                    <div style={{ position: "relative" }}>
                      <AvatarPlaceholder size={96} />
                      {speakingState.get(remoteParticipantId)?.isSpeaking && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#3ba55d",
                            border: "2px solid rgba(18,19,32,0.98)",
                            boxShadow: "0 0 8px rgba(59,165,93,0.6)",
                          }}
                          className="animate-pulse"
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {callerData?.name}
                    </div>
                    <div
                      style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}
                      className="animate-pulse"
                    >
                      Идет разговор...
                    </div>
                  </div>
                )}
              </div>

              {/* Control bar */}
              <div style={glassControlBar}>
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
