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

  useEffect(() => {
    if (callState === "incoming") {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio(RINGTONE_URL);
        ringtoneRef.current.loop = true; 
      }
      ringtoneRef.current.play().catch((err) => {
        console.warn("Автовоспроизведение рингтона заблокировано браузером. Пользователь должен взаимодействовать со страницей.", err);
      });
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [callState]);

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
        remoteVideoRef.current.play().catch(console.error);
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(console.error);
      }
    }
  }, [remoteStream, callState]);

  if (callState === "idle") return null;

  return (
    <div className="call-overlay">
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
                    <p>00:00</p> 
                </div>
            )}
            
            {isVideoCall && (
                <video ref={localVideoRef} autoPlay muted playsInline className="local-video-pip" />
            )}
          </div>

          <div className="call-controls">
            <button onClick={muteAudio} className={isAudioMuted ? "control-btn active" : "control-btn"}>
               🎤 {isAudioMuted ? "Вкл Звук" : "Выкл Звук"}
            </button>
            {isVideoCall && (
                <button onClick={muteVideo} className={isVideoMuted ? "control-btn active" : "control-btn"}>
                 📷 {isVideoMuted ? "Вкл Видео" : "Выкл Видео"}
                </button>
            )}
            <button className="control-btn hangup" onClick={endCall}>📞</button>
          </div>
        </div>
      )}
    </div>
  );
}