import React, { useEffect, useRef } from "react";
import { useCall } from "../context/CallContext";
import "./CallOverlay.css";

export default function CallOverlay() {
  const {
    callState,
    isVideoCall,
    localStream,
    remoteStream,
    callerData,
    answerCall,
    endCall,
    muteAudio,
    muteVideo,
    isAudioMuted,
    isVideoMuted
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  if (callState === "idle") return null;

  return (
    <div className="call-overlay">
      {callState === "incoming" && (
        <div className="call-card incoming">
          <div className="call-avatar-placeholder">
            {callerData?.name[0].toUpperCase()}
          </div>
          <h3>{callerData?.name}</h3>
          <p>{isVideoCall ? "Входящий видеозвонок..." : "Входящий аудиозвонок..."}</p>
          <div className="call-actions">
            <button className="btn-decline" onClick={endCall}>
              Отклонить
            </button>
            <button className="btn-accept" onClick={answerCall}>
              Принять
            </button>
          </div>
        </div>
      )}

      {callState === "calling" && (
        <div className="call-card calling">
          <div className="video-preview">
             {isVideoCall && localStream && (
                <video ref={localVideoRef} autoPlay muted playsInline className="local-preview" />
             )}
          </div>
          <h3>Звонок...</h3>
          <div className="call-actions">
            <button className="btn-decline" onClick={endCall}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {callState === "connected" && (
        <div className={`call-active ${isVideoCall ? "video-mode" : "audio-mode"}`}>
          <div className="video-container">
            {isVideoCall && (
                 <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
            )}
            {!isVideoCall && (
                <div className="audio-placeholder">
                    <div className="big-avatar">{callerData?.name[0]}</div>
                    <h3>{callerData?.name}</h3>
                    <p>Идет разговор...</p>
                </div>
            )}

            {isVideoCall && (
                <video ref={localVideoRef} autoPlay muted playsInline className="local-video-pip" />
            )}
          </div>

          <div className="call-controls">
            <button onClick={muteAudio} className={isAudioMuted ? "control-btn active" : "control-btn"}>
               🎤
            </button>
            {isVideoCall && (
                <button onClick={muteVideo} className={isVideoMuted ? "control-btn active" : "control-btn"}>
                 📷
                </button>
            )}
            <button className="control-btn hangup" onClick={endCall}>
              📞 Завершить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}