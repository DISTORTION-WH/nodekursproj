import React, { useEffect, useRef } from "react";
import { useCall } from "../context/CallContext";

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
            remoteVideoRef.current.muted = false;
            remoteVideoRef.current.play().catch(console.error);
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play().catch(console.error);
        }
    }
  }, [remoteStream, callState]);

  if (callState === "idle") return null;

  const btnBase = "border-none py-3 px-6 rounded-full text-white cursor-pointer font-bold text-base transition-colors";
  const btnAccept = `${btnBase} bg-success hover:bg-[#3ba55d]`;
  const btnDecline = `${btnBase} bg-danger hover:bg-danger-hover`;
  
  const controlBtn = "border-none text-white w-[50px] h-[50px] rounded-full cursor-pointer text-lg transition-colors flex items-center justify-center";
  const controlBtnNormal = `${controlBtn} bg-[#36393f] hover:bg-[#40444b]`;
  const controlBtnActive = `${controlBtn} bg-danger hover:bg-danger-hover`;

  return (
    <div className="fixed inset-0 bg-black/85 z-[9999] flex justify-center items-center text-white">
      
      {callState === "connected" && (
          <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
      )}

      {callState === "incoming" && (
        <div className="bg-bg p-10 rounded-2xl text-center w-[300px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-pulseCall">
          <div className="w-20 h-20 bg-accent rounded-full mx-auto mb-5 flex items-center justify-center text-[2rem] font-bold">
            {callerData?.name ? callerData.name[0].toUpperCase() : "?"}
          </div>
          <h3 className="text-xl font-bold mb-2">{callerData?.name}</h3>
          <p className="text-text-muted mb-6">
            {isVideoCall ? "Входящий видеозвонок..." : "Входящий аудиозвонок..."}
          </p>
          <div className="flex justify-around mt-8">
            <button className={btnDecline} onClick={endCall}>Отклонить</button>
            <button className={btnAccept} onClick={answerCall}>Принять</button>
          </div>
        </div>
      )}

      {callState === "calling" && (
        <div className="bg-bg p-10 rounded-2xl text-center w-[300px] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <div className="mb-5">
             {isVideoCall && localStream && (
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-[200px] bg-black object-cover rounded-lg scale-x-[-1]" />
             )}
          </div>
          <h3 className="text-xl font-bold mb-6">Звонок...</h3>
          <div className="flex justify-around mt-8">
            <button className={btnDecline} onClick={endCall}>Отмена</button>
          </div>
        </div>
      )}

      {callState === "connected" && (
        <div className={`w-full h-full flex flex-col relative ${isVideoCall ? "video-mode" : "audio-mode"}`}>
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            
            {isVideoCall ? (
                 <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-contain max-w-full max-h-full scale-x-[-1]" 
                 />
            ) : (
                <div className="text-center">
                    <div className="w-20 h-20 bg-accent rounded-full mx-auto mb-5 flex items-center justify-center text-[2rem] font-bold">
                      {callerData?.name ? callerData.name[0].toUpperCase() : "?"}
                    </div>
                    <h3 className="text-xl font-bold mb-2">{callerData?.name}</h3>
                    <p className="text-text-muted">Идет разговор...</p>
                </div>
            )}

            {isVideoCall && (
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="absolute bottom-[100px] right-5 w-[240px] h-[135px] object-cover rounded-lg border-2 border-[#36393f] bg-black shadow-lg z-[2] scale-x-[-1] md:w-[120px] md:h-[67.5px] md:bottom-[90px] md:right-2.5" 
                />
            )}
          </div>

          <div className="h-20 bg-bg-block flex justify-center items-center gap-5 shrink-0">
            <button onClick={muteAudio} className={isAudioMuted ? controlBtnActive : controlBtnNormal}>
               🎤 {isAudioMuted ? "Вкл" : ""}
            </button>
            
            {isVideoCall && (
                <button onClick={muteVideo} className={isVideoMuted ? controlBtnActive : controlBtnNormal}>
                 📷 {isVideoMuted ? "Вкл" : ""}
                </button>
            )}
            
            <button 
              className="border-none bg-danger text-white h-[50px] px-5 rounded-[25px] cursor-pointer text-lg transition-colors hover:bg-danger-hover flex items-center gap-2" 
              onClick={endCall}
            >
              📞 Завершить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}