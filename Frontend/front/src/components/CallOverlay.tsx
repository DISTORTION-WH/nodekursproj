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
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // 1. Настройка ЛОКАЛЬНОГО видео
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // Всегда глушим себя локально
    }
  }, [localStream, callState]);

  // 2. Настройка УДАЛЕННОГО потока
  useEffect(() => {
    if (remoteStream) {
        // Пытаемся прикрепить к видео (если это видеозвонок)
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.onloadedmetadata = () => {
                remoteVideoRef.current?.play().catch(e => console.error("Auto-play failed (video)", e));
            };
        }

        // ИЛИ прикрепляем к скрытому аудио (если это аудиозвонок или для подстраховки)
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.onloadedmetadata = () => {
                remoteAudioRef.current?.play().catch(e => console.error("Auto-play failed (audio)", e));
            };
        }
    }
  }, [remoteStream, isVideoCall]); // Зависимость от isVideoCall важна для ре-рендера

  if (callState === "idle") return null;

  return (
    <div className="call-overlay">
      
      {/* СКРЫТЫЙ АУДИО ПЛЕЕР (Для гарантии звука, даже если видео глючит) */}
      {callState === "connected" && (
          <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      )}

      {/* --- Входящий звонок --- */}
      {callState === "incoming" && (
        <div className="call-card incoming">
          <div className="call-avatar-placeholder">
            {callerData?.name ? callerData.name[0].toUpperCase() : "?"}
          </div>
          <h3>{callerData?.name}</h3>
          <p>{isVideoCall ? "Входящий видеозвонок..." : "Входящий аудиозвонок..."}</p>
          <div className="call-actions">
            <button className="btn-decline" onClick={endCall}>Отклонить</button>
            <button className="btn-accept" onClick={answerCall}>Принять</button>
          </div>
        </div>
      )}

      {/* --- Исходящий звонок --- */}
      {callState === "calling" && (
        <div className="call-card calling">
          <div className="video-preview">
             {isVideoCall && localStream ? (
                <video ref={localVideoRef} autoPlay muted playsInline className="local-preview" />
             ) : (
                <div className="call-avatar-placeholder" style={{marginBottom: 0}}>You</div>
             )}
          </div>
          <h3 style={{ marginTop: 10 }}>Звонок...</h3>
          <div className="call-actions">
            <button className="btn-decline" onClick={endCall}>Отмена</button>
          </div>
        </div>
      )}

      {/* --- Разговор --- */}
      {callState === "connected" && (
        <div className={`call-active ${isVideoCall ? "video-mode" : "audio-mode"}`}>
          <div className="video-container">
            
            {/* Видео собеседника */}
            {isVideoCall ? (
                 <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="remote-video" 
                 />
            ) : (
                <div className="audio-placeholder">
                    <div className="big-avatar">
                      {callerData?.name ? callerData.name[0].toUpperCase() : "?"}
                    </div>
                    <h3>{callerData?.name}</h3>
                    <p>Идет разговор...</p>
                </div>
            )}

            {/* Мое маленькое видео (PiP) */}
            {isVideoCall && (
                <video ref={localVideoRef} autoPlay muted playsInline className="local-video-pip" />
            )}
          </div>

          <div className="call-controls">
            <button onClick={muteAudio} className={isAudioMuted ? "control-btn active" : "control-btn"}>
               {isAudioMuted ? "🔇" : "🎤"}
            </button>
            
            {isVideoCall && (
                <button onClick={muteVideo} className={isVideoMuted ? "control-btn active" : "control-btn"}>
                 {isVideoMuted ? "🚫" : "📷"}
                </button>
            )}
            
            <button className="control-btn hangup" onClick={endCall}>📞</button>
          </div>
        </div>
      )}
    </div>
  );
}