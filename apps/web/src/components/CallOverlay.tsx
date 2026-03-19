import React, { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { getImageUrl } from "../utils/imageUrl";
import { useCall } from "../context/CallContext";
import { GroupCallParticipant } from "../types";
import { useAuth } from "../context/AuthContext";
import SubtitlesOverlay, { CCButton, SubtitleSettingsPopup } from "./SubtitlesOverlay";
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

// ─── Minimize button ──────────────────────────────────────────────────────────

interface MinimizeBtnProps {
  onClick: () => void;
}

function MinimizeBtn({ onClick }: MinimizeBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title="Свернуть"
      style={{
        background: hovered ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
        border: "none",
        borderRadius: 8,
        padding: "6px 10px",
        color: hovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
        cursor: "pointer",
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "background 0.15s ease, color 0.15s ease",
        flexShrink: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>—</span>
      <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>Свернуть</span>
    </button>
  );
}

// ─── Duration formatter ───────────────────────────────────────────────────────

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `0:${String(sec).padStart(2, "0")}`;
}

// ─── Participant tile for group call ─────────────────────────────────────────

interface ParticipantTileProps {
  participant: GroupCallParticipant;
  isLocal?: boolean;
}

function ParticipantTile({
  participant,
  isLocal = false,
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
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
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
        {isLocal ? "Вы" : participant.username}
        {participant.audioMuted && <span>🔇</span>}
      </div>
    </div>
  );
}

// ─── Minimized tray pill ──────────────────────────────────────────────────────

interface TrayPillProps {
  callDuration: number;
  isGroupCall: boolean;
  callerName?: string;
  participantCount: number;
  onExpand: () => void;
  onEnd: () => void;
}

function TrayPill({
  callDuration,
  isGroupCall,
  callerName,
  participantCount,
  onExpand,
  onEnd,
}: TrayPillProps) {
  const [expandHovered, setExpandHovered] = useState(false);
  const [endHovered, setEndHovered] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: "rgba(20,21,35,0.95)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(88,101,242,0.4)",
        borderRadius: 50,
        padding: "10px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(88,101,242,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Green pulsing active indicator */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#57f287",
            boxShadow: "0 0 8px rgba(87,242,135,0.7)",
            animation: "pulse-dot 1.8s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <style>{`
          @keyframes pulse-dot {
            0%, 100% { box-shadow: 0 0 4px rgba(87,242,135,0.7); transform: scale(1); }
            50% { box-shadow: 0 0 12px rgba(87,242,135,0.9); transform: scale(1.2); }
          }
        `}</style>
      </div>

      {/* Call info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
        onClick={onExpand}
        title="Развернуть"
      >
        {isGroupCall ? (
          <>
            <span style={{ fontSize: 14 }}>👥</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                whiteSpace: "nowrap",
              }}
            >
              {participantCount} участн.
            </span>
          </>
        ) : (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              whiteSpace: "nowrap",
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {callerName ?? "Звонок"}
          </span>
        )}

        {/* Duration */}
        <span
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {fmtDuration(callDuration)}
        </span>

        {/* Phone icon */}
        <span style={{ fontSize: 14 }}>📞</span>
      </div>

      {/* Expand button */}
      <button
        onClick={onExpand}
        title="Развернуть"
        style={{
          background: expandHovered ? "rgba(88,101,242,0.25)" : "rgba(88,101,242,0.12)",
          border: "1px solid rgba(88,101,242,0.3)",
          borderRadius: 8,
          padding: "4px 8px",
          color: "rgba(168,180,255,0.9)",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 4,
          transition: "background 0.15s ease",
          flexShrink: 0,
        }}
        onMouseEnter={() => setExpandHovered(true)}
        onMouseLeave={() => setExpandHovered(false)}
      >
        ▲
      </button>

      {/* End call button */}
      <button
        onClick={onEnd}
        title="Завершить звонок"
        style={{
          background: endHovered
            ? "linear-gradient(135deg, #f05154, #c0392b)"
            : "linear-gradient(135deg, #ed4245, #c0392b)",
          border: "none",
          borderRadius: 8,
          padding: "4px 10px",
          color: "#fff",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          boxShadow: endHovered
            ? "0 4px 16px rgba(237,66,69,0.55)"
            : "0 2px 8px rgba(237,66,69,0.4)",
          transition: "box-shadow 0.15s ease, background 0.15s ease",
          flexShrink: 0,
        }}
        onMouseEnter={() => setEndHovered(true)}
        onMouseLeave={() => setEndHovered(false)}
      >
        ✕
      </button>
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
    subtitlesEnabled,
    speechLang,
    displayLang,
    toggleSubtitles,
    setSpeechLang,
    setDisplayLang,
  } = useCallFeatures();

  const participantCount = groupCallState === "active" ? groupCallParticipants.length + 1 : 2;

  // ─── Minimize / tray state ────────────────────────────────────────────────
  const [minimized, setMinimized] = useState(false);
  const [subtitlePopupOpen, setSubtitlePopupOpen] = useState(false);

  // Show popup automatically when subtitles are first enabled
  const prevSubtitlesEnabled = useRef(subtitlesEnabled);
  useEffect(() => {
    if (subtitlesEnabled && !prevSubtitlesEnabled.current) {
      setSubtitlePopupOpen(true);
    }
    prevSubtitlesEnabled.current = subtitlesEnabled;
  }, [subtitlesEnabled]);

  // ─── Call duration timer ──────────────────────────────────────────────────
  const [callDuration, setDuration] = useState(0);

  useEffect(() => {
    const isActive = callState === "connected" || groupCallState === "active";
    if (!isActive) { setDuration(0); return; }
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [callState, groupCallState]);

  // Reset minimize + duration when all calls end
  useEffect(() => {
    if (callState === "idle" && groupCallState === "idle") {
      setMinimized(false);
      setDuration(0);
    }
  }, [callState, groupCallState]);

  // ─── Video refs ───────────────────────────────────────────────────────────
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
      const tracks = remoteStream.getTracks();
      console.log("[CALL-UI] Remote stream received:", tracks.length, "tracks:", tracks.map(t => `${t.kind}(${t.readyState})`).join(", "));

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((err) => {
          console.warn("[CALL-UI] Video play blocked:", err.message);
          const retry = () => { remoteVideoRef.current?.play().catch(console.error); document.removeEventListener("click", retry); };
          document.addEventListener("click", retry);
        });
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch((err) => {
          console.warn("[CALL-UI] Audio play blocked:", err.message);
          const retry = () => { remoteAudioRef.current?.play().catch(console.error); document.removeEventListener("click", retry); };
          document.addEventListener("click", retry);
        });
      }
    }
  }, [remoteStream, isVideoCall, callState]);

  const callerInitial = callerData?.name ? callerData.name[0].toUpperCase() : "?";
  const myInitial = currentUser?.username ? currentUser.username[0].toUpperCase() : "?";

  // Load remote avatar from API
  const [remoteAvatarUrl, setRemoteAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!callerData?.id) { setRemoteAvatarUrl(null); return; }
    api.get(`/users/${callerData.id}`).then((res) => {
      setRemoteAvatarUrl(res.data?.avatar_url ?? null);
    }).catch(() => setRemoteAvatarUrl(null));
  }, [callerData?.id]);

  // Avatar components
  const remoteAvatarSrc = getImageUrl(remoteAvatarUrl);
  const myAvatarSrc = getImageUrl(currentUser?.avatar_url ?? null);

  const CallAvatar = ({ src, initial, size = 80, isSpeaking = false }: { src: string; initial: string; size?: number; isSpeaking?: boolean }) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    return (
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: size, height: size, borderRadius: "50%",
          border: isSpeaking ? "3px solid #7c5cfc" : "3px solid rgba(255,255,255,0.08)",
          boxShadow: isSpeaking ? "0 0 0 3px rgba(124,92,252,0.35), 0 8px 32px rgba(0,0,0,0.4)" : "0 8px 32px rgba(0,0,0,0.4)",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          overflow: "hidden",
          background: "linear-gradient(135deg, #5865f2, #4752c4)",
          position: "relative",
        }}>
          {!imgError && (
            <img src={src} alt={initial}
              style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 2 }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)} />
          )}
          {(!imgLoaded || imgError) && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: size * 0.38, fontWeight: 700, zIndex: 1,
            }}>{initial}</div>
          )}
        </div>
        {isSpeaking && (
          <span style={{
            position: "absolute", bottom: -2, right: -2, width: 18, height: 18,
            borderRadius: "50%", background: "#7c5cfc",
            border: "2px solid rgba(18,19,32,0.98)",
            boxShadow: "0 0 10px rgba(124,92,252,0.8)",
          }} className="animate-pulse" />
        )}
      </div>
    );
  };

  const AvatarPlaceholder = ({ size = 80 }: { size?: number }) => (
    <CallAvatar src={remoteAvatarSrc} initial={callerInitial} size={size} />
  );

  const showBanner =
    incomingGroupCall !== null && groupCallState === "idle" && callState === "idle";

  const remoteParticipantId = callerData ? String(callerData.id) : "remote";

  // Derived: whether a call is currently active and can be minimized
  const isCallActive =
    callState === "connected" || groupCallState === "active";

  // ─── Glassmorphism control bar style ─────────────────────────────────────
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
    position: "sticky",
    bottom: 0,
  };

  // ─── Tray pill (rendered when minimized and a call is active) ────────────
  if (minimized && isCallActive) {
    const totalParticipants = groupCallParticipants.length + 1;
    return (
      <>
        {/* Keep audio element alive while minimized so 1-on-1 audio continues */}
        {callState === "connected" && (
          <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
        )}
        <TrayPill
          callDuration={callDuration}
          isGroupCall={groupCallState === "active"}
          callerName={callerData?.name}
          participantCount={totalParticipants}
          onExpand={() => setMinimized(false)}
          onEnd={() => {
            if (groupCallState === "active") leaveGroupCall();
            else endCall();
          }}
        />
      </>
    );
  }

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
            overflow: "hidden",
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
            {/* Left: status dot + title + participant count + duration */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#57f287",
                  boxShadow: "0 0 8px rgba(87,242,135,0.6)",
                  flexShrink: 0,
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
              {/* Duration timer */}
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.45)",
                  fontVariantNumeric: "tabular-nums",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 999,
                  padding: "2px 10px",
                }}
              >
                {fmtDuration(callDuration)}
              </span>
            </div>

            {/* Right: network quality + minimize button */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <NetworkQualityIndicator />
              <MinimizeBtn onClick={() => setMinimized(true)} />
            </div>
          </div>

          {/* Participant grid */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
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
                  />
                  {groupCallParticipants.map((p) => (
                    <ParticipantTile
                      key={p.userId}
                      participant={p}
                    />
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Control bar — sticky to bottom */}
          <div style={glassControlBar}>
            <ControlBtn onClick={muteGroupAudio} active={isGroupAudioMuted} title="Микрофон">
              {isGroupAudioMuted ? "🔇" : "🎤"}
            </ControlBtn>
            {groupCallIsVideo && (
              <ControlBtn onClick={muteGroupVideo} active={isGroupVideoMuted} title="Камера">
                {isGroupVideoMuted ? "🚫" : "📷"}
              </ControlBtn>
            )}
            {/* Subtitles */}
            <div style={{ position: "relative" }}>
              <CCButton active={subtitlesEnabled} onToggle={() => {
                if (!subtitlesEnabled) { toggleSubtitles(); }
                else { setSubtitlePopupOpen((v) => !v); }
              }} />
              {subtitlesEnabled && (
                <button
                  onClick={() => { toggleSubtitles(); setSubtitlePopupOpen(false); }}
                  title="Отключить субтитры"
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center leading-none hover:bg-red-400"
                >
                  x
                </button>
              )}
              {subtitlePopupOpen && subtitlesEnabled && (
                <SubtitleSettingsPopup
                  speechLang={speechLang}
                  displayLang={displayLang}
                  onSpeechLangChange={setSpeechLang}
                  onDisplayLangChange={setDisplayLang}
                  onClose={() => setSubtitlePopupOpen(false)}
                />
              )}
            </div>
            <ControlBtn onClick={leaveGroupCall} danger title="Покинуть звонок">
              📞
            </ControlBtn>
          </div>

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
            overflow: "hidden",
          }}
        >
          {/* Always mount audio element so ref is ready when remote stream arrives */}
          <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

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
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
              }}
              className="animate-fade-in-up"
            >
              {/* Top bar: network quality + minimize */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
                  pointerEvents: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, pointerEvents: "auto" }}>
                  <NetworkQualityIndicator />
                  {/* Duration */}
                  <span
                    style={{
                      background: "rgba(0,0,0,0.45)",
                      backdropFilter: "blur(8px)",
                      borderRadius: 999,
                      padding: "3px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.8)",
                      fontVariantNumeric: "tabular-nums",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {fmtDuration(callDuration)}
                  </span>
                </div>
                <div style={{ pointerEvents: "auto" }}>
                  <MinimizeBtn onClick={() => setMinimized(true)} />
                </div>
              </div>

              {/* Main video/avatar area */}
              {isVideoCall ? (
                /* ─── VIDEO CALL: remote fills screen, local PiP ─── */
                <div style={{ position: "relative", flex: 1, background: "#0a0a14", minHeight: 0 }}>
                  {/* Remote video — full area */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {/* Remote name label */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 80,
                      left: 16,
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(8px)",
                      borderRadius: 999,
                      padding: "3px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {callerData?.name}
                  </div>
                  {/* Local video — PiP bottom-right */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 80,
                      right: 16,
                      width: 160,
                      height: 100,
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "2px solid rgba(88,101,242,0.7)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                      background: "#111",
                    }}
                  >
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: "scaleX(-1)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: 6,
                        fontSize: 10,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      Вы
                    </div>
                  </div>
                </div>
              ) : (
                /* ─── AUDIO CALL: two equal-size side-by-side blocks ─── */
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 24, padding: "80px 40px 100px",
                }}>
                  {/* Remote participant block */}
                  <div style={{
                    width: 220, height: 220, flexShrink: 0,
                    background: "rgba(15,16,28,0.85)",
                    border: "2px solid rgba(255,255,255,0.07)",
                    borderRadius: 24,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", gap: 14,
                  }}>
                    <CallAvatar
                      src={remoteAvatarSrc} initial={callerInitial} size={96}
                      isSpeaking={false}
                    />
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{callerData?.name}</div>
                  </div>

                  {/* Local self block */}
                  <div style={{
                    width: 220, height: 220, flexShrink: 0,
                    background: "rgba(15,16,28,0.85)",
                    border: "2px solid rgba(255,255,255,0.07)",
                    borderRadius: 24,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", gap: 14,
                  }}>
                    <div style={{ position: "relative" }}>
                      <CallAvatar
                        src={myAvatarSrc} initial={myInitial} size={96}
                        isSpeaking={false}
                      />
                      {isAudioMuted && (
                        <span style={{
                          position: "absolute", top: -4, right: -4, width: 22, height: 22,
                          borderRadius: "50%", background: "#ed4245",
                          border: "2px solid rgba(18,19,32,0.98)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                        }}>🔇</span>
                      )}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{currentUser?.username ?? "Вы"}</div>
                    {isAudioMuted && <div style={{ fontSize: 11, color: "#ed4245", fontWeight: 600 }}>Заглушён</div>}
                  </div>
                </div>
              )}

              {/* Control bar — sticky at bottom */}
              <div
                style={{
                  ...glassControlBar,
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  pointerEvents: "auto",
                }}
              >
                <ControlBtn onClick={muteAudio} active={isAudioMuted} title="Микрофон">
                  {isAudioMuted ? "🔇" : "🎤"}
                </ControlBtn>
                {isVideoCall && (
                  <ControlBtn onClick={muteVideo} active={isVideoMuted} title="Камера">
                    {isVideoMuted ? "🚫" : "📷"}
                  </ControlBtn>
                )}
                <div style={{ position: "relative" }}>
                  <CCButton active={subtitlesEnabled} onToggle={() => {
                    if (!subtitlesEnabled) { toggleSubtitles(); }
                    else { setSubtitlePopupOpen((v) => !v); }
                  }} />
                  {subtitlesEnabled && (
                    <button
                      onClick={() => { toggleSubtitles(); setSubtitlePopupOpen(false); }}
                      title="Отключить субтитры"
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center leading-none hover:bg-red-400"
                    >
                      x
                    </button>
                  )}
                  {subtitlePopupOpen && subtitlesEnabled && (
                    <SubtitleSettingsPopup
                      speechLang={speechLang}
                      displayLang={displayLang}
                      onSpeechLangChange={setSpeechLang}
                      onDisplayLangChange={setDisplayLang}
                      onClose={() => setSubtitlePopupOpen(false)}
                    />
                  )}
                </div>
                <ControlBtn onClick={endCall} danger title="Завершить">
                  📞
                </ControlBtn>
              </div>

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
