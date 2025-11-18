import React, { useEffect, useRef } from "react";
import { useCall } from "../context/CallContext";
import "./CallOverlay.css";

const RINGTONE_URL = "/ringtone.mp3"; 

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
  
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Логика рингтона
  useEffect(() => {
    if (callState === "incoming") {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio(RINGTONE_URL);
        ringtoneRef.current.loop = true; 
      }
      ringtoneRef.current.play().catch((err) => {
        console.warn("Автовоспроизведение рингтона заблокировано. Нужно взаимодействие.", err);
      });
    } else {
      // Останавливаем звук при любом другом состоянии (разговор, сброс и т.д.)
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [callState]);

  // Привязка локального стрима
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // Чтобы не слышать себя
    }
  }, [localStream, callState]);

  // Привязка удаленного стрима
  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.error);
      }
      // Если аудио-звонок или видео (звук всегда идет через audio или video тэг)
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(console.error);
      }
    }
  }, [remoteStream, callState]);

  if (callState === "idle") return null;

  return (
    <div className="call-overlay">
      {/* Скрытый элемент для аудио собеседника (особенно важно для аудио-звонков) */}
      {callState === "connected" && (
         <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
      )}

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

      {callState === "calling" && (
        <div className="call-card calling">
          <div className="video-preview">
             {isVideoCall && localStream && (
                <video ref={localVideoRef} autoPlay muted playsInline className="local-preview" />
             )}
          </div>
          <h3>Звонок...</h3>
          <div className="call-actions">
            <button className="btn-decline" onClick={endCall}>Отмена</button>
          </div>
        </div>
      )}

      {callState === "connected" && (
        <div className={`call-active ${isVideoCall ? "video-mode" : "audio-mode"}`}>
          <div className="video-container">
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
                 {isVideoMuted ? "❌" : "📷"}
                </button>
            )}
            <button className="control-btn hangup" onClick={endCall}>📞</button>
          </div>
        </div>
      )}
    </div>
  );
}