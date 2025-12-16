import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { Socket } from "socket.io-client";

interface CallContextType {
  callState: "idle" | "incoming" | "connected" | "calling";
  isVideoCall: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callerData: { id: number; name: string } | null;
  startCall: (userId: number, isVideo: boolean) => void;
  answerCall: () => void;
  endCall: () => void;
  muteAudio: () => void;
  muteVideo: () => void;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within CallProvider");
  return context;
};

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocket() as { socket: Socket | null };
  const { currentUser } = useAuth();

  const [callState, setCallState] = useState<"idle" | "incoming" | "connected" | "calling">("idle");
  const [isVideoCall, setIsVideoCall] = useState(false);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [callerData, setCallerData] = useState<{ id: number; name: string } | null>(null);
  
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const otherUserId = useRef<number | null>(null);
  const pendingOffer = useRef<any>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  const resetCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState("idle");
    setCallerData(null);
    otherUserId.current = null;
    pendingOffer.current = null;
    iceCandidatesQueue.current = [];
    setIsAudioMuted(false);
    setIsVideoMuted(false);
  }, [localStream]);

  const createPeerConnection = () => {
    if (peerConnection.current) {
        peerConnection.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && otherUserId.current && socket) {
        socket.emit("send_ice_candidate", {
          to: otherUserId.current,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("📡 Получен трек:", event.track.kind, event.track.id);
      
      const incomingTrack = event.track;
      const incomingStream = event.streams[0];

      setRemoteStream((prev) => {
        if (incomingStream) {
            return incomingStream;
        }
        
        const newStream = new MediaStream();
        if (prev) {
            prev.getTracks().forEach(t => newStream.addTrack(t));
        }
        newStream.addTrack(incomingTrack);
        return newStream;
      });
    };

    pc.oniceconnectionstatechange = () => {
        console.log("❄️ ICE State:", pc.iceConnectionState);
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
             console.warn("Связь прервана");
        }
    };

    return pc;
  };

  const processIceQueue = async () => {
    if (!peerConnection.current) return;
    while (iceCandidatesQueue.current.length > 0) {
        const candidate = iceCandidatesQueue.current.shift();
        if (candidate) {
            try {
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("🧊 Добавлен ICE кандидат из очереди");
            } catch (e) { console.error("Ошибка добавления ICE кандидата:", e); }
        }
    }
  };

  const getMediaStream = async (video: boolean) => {
    try {
      // Попытка 1: Запрашиваем то, что нужно (например, Видео + Аудио)
      const stream = await navigator.mediaDevices.getUserMedia({ video: video, audio: true });
      
      console.log("🎤 Локальный стрим получен:", stream.id);
      setLocalStream(stream);
      return stream;
    } catch (err: any) {
      console.error("Ошибка доступа к медиа (Попытка 1):", err);

      // --- НАЧАЛО ИЗМЕНЕНИЙ ---
      // Если мы просили видео, но произошла ошибка (например, камера занята),
      // попробуем запросить ТОЛЬКО аудио.
      if (video) {
        try {
          console.warn("⚠️ Камера недоступна или занята. Пробуем переключиться на аудио-режим...");
          const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          
          setLocalStream(audioStream);
          // Можно опционально уведомить пользователя
          // alert("Камера занята другой вкладкой. Включен только микрофон.");
          return audioStream;
        } catch (audioErr) {
          console.error("Даже микрофон недоступен:", audioErr);
        }
      }
      // --- КОНЕЦ ИЗМЕНЕНИЙ ---

      alert("Не удалось получить доступ к камере или микрофону.\nУбедитесь, что устройства не заняты другим приложением.");
      resetCall();
      return null;
    }
  };

  useEffect(() => {
    if (!socket) return;

    socket.on("incoming_call", (data) => {
      if (callState !== "idle") {
         return;
      }
      console.log("📞 Входящий звонок от", data.name);
      setCallerData({ id: data.from, name: data.name });
      setIsVideoCall(data.isVideo);
      setCallState("incoming");
      otherUserId.current = data.from;
      pendingOffer.current = data.signal;
    });

    socket.on("call_accepted", async (signal) => {
      console.log("✅ Звонок принят, устанавливаем remote description");
      setCallState("connected");
      if (peerConnection.current) {
        try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
            processIceQueue();
        } catch (e) {
            console.error("Ошибка setRemoteDescription (answer):", e);
        }
      }
    });

    socket.on("receive_ice_candidate", async (data) => {
      const candidate = data.candidate;
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        try { 
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate)); 
        } catch (e) { console.error(e); }
      } else {
        iceCandidatesQueue.current.push(candidate);
      }
    });

    socket.on("call_ended", () => {
        console.log("📴 Звонок завершен собеседником");
        resetCall();
    });

    return () => {
      socket.off("incoming_call");
      socket.off("call_accepted");
      socket.off("receive_ice_candidate");
      socket.off("call_ended");
    };
  }, [socket, callState, resetCall]);



  const startCall = async (userId: number, video: boolean) => {
    if (!socket || !currentUser) return;
    setIsVideoCall(video);
    otherUserId.current = userId;
    setCallState("calling");

    const stream = await getMediaStream(video);
    if (!stream) return; 

    const pc = createPeerConnection();
    peerConnection.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log("📤 Отправка offer пользователю", userId);
    socket.emit("call_user", {
      userToCall: userId,
      signalData: offer,
      from: currentUser.id,
      name: currentUser.username,
      isVideo: video,
    });
  };

  const answerCall = async () => {
    if (!socket || !otherUserId.current) return;
    
    setCallState("connected");

    const stream = await getMediaStream(isVideoCall);
    if (!stream) return;

    const pc = createPeerConnection();
    peerConnection.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    if (pendingOffer.current) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
            processIceQueue();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            console.log("📤 Отправка answer");
            socket.emit("answer_call", { signal: answer, to: otherUserId.current });
        } catch (e) {
            console.error("Ошибка при ответе на звонок:", e);
            endCall();
        }
    }
  };

  const endCall = () => {
    if (socket && otherUserId.current) {
      socket.emit("end_call", { to: otherUserId.current });
    }
    resetCall();
  };

  const muteAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsAudioMuted(prev => !prev);
    }
  };

  const muteVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoMuted(prev => !prev);
    }
  };

  return (
    <CallContext.Provider
      value={{ 
          callState, isVideoCall, 
          localStream, remoteStream, 
          callerData, 
          startCall, answerCall, endCall, 
          muteAudio, muteVideo, isAudioMuted, isVideoMuted 
      }}
    >
      {children}
    </CallContext.Provider>
  );
};