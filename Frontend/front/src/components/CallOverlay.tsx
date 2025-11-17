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
  // Создаем отдельный ref для аудио, чтобы гарантировать звук
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // 1. Настройка ЛОКАЛЬНОГО видео (Моя камера)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // Всегда глушим себя
    }
  }, [localStream, callState]);

  // 2. Настройка УДАЛЕННОГО потока (Звук + Видео)
  useEffect(() => {
    if (remoteStream) {
        // А) Если есть видео-элемент, подключаем к нему
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.muted = false; // ВАЖНО: Звук включен
            remoteVideoRef.current.play().catch(console.error);
        }

        // Б) ДОПОЛНИТЕЛЬНО: Подключаем к скрытому аудио-элементу для надежности
        // Это хак, который часто спасает, если видео-тег глючит со звуком
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play().catch(console.error);
        }
    }
  }, [remoteStream, callState]);

  if (callState === "idle") return null;

  return (
    <div className="call-overlay">
      
      {/* СКРЫТЫЙ АУДИО ПЛЕЕР (Всегда включен во время звонка) */}
      {callState === "connected" && (
          <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
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
                    // volume={1.0} // React не поддерживает атрибут volume, это делается через ref
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

            {/* Мое маленькое видео */}
            {isVideoCall && (
                <video ref={localVideoRef} autoPlay muted playsInline className="local-video-pip" />
            )}
          </div>

          <div className="call-controls">
            <button onClick={muteAudio} className={isAudioMuted ? "control-btn active" : "control-btn"}>
               🎤 {isAudioMuted ? "Вкл" : ""}
            </button>
            
            {isVideoCall && (
                <button onClick={muteVideo} className={isVideoMuted ? "control-btn active" : "control-btn"}>
                 📷 {isVideoMuted ? "Вкл" : ""}
                </button>
            )}
            
            <button className="control-btn hangup" onClick={endCall}>📞 Завершить</button>
          </div>
        </div>
      )}
    </div>
  );
}