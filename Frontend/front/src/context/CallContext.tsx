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
      console.log("📡 Получен удаленный поток (Audio/Video)");
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
        console.log("Статус соединения WebRTC:", pc.connectionState);
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
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
                console.log("✅ Добавлен ICE кандидат из очереди");
            } catch (e) {
                console.error("Ошибка добавления ICE из очереди", e);
            }
        }
    }
  };

  const getMediaStream = async (video: boolean) => {
    try {
      console.log("Запрос доступа к медиа devices...");
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("❌ Ошибка доступа к камере/микрофону:", err);
      alert("Не удалось получить доступ к камере или микрофону. Проверьте разрешения в браузере (замочек в строке адреса).");
      return null;
    }
  };

  useEffect(() => {
    if (!socket) return;

    socket.on("incoming_call", async (data: { from: number; name: string; signal: any; isVideo: boolean }) => {
      console.log("📞 Входящий звонок от:", data.name);
      if (callState !== "idle") {
          console.log("Линия занята");
          return; 
      }

      setCallerData({ id: data.from, name: data.name });
      setIsVideoCall(data.isVideo);
      setCallState("incoming");
      otherUserId.current = data.from;
      pendingOffer.current = data.signal;
    });

    socket.on("call_accepted", async (signal) => {
      console.log("✅ Звонок принят собеседником");
      setCallState("connected");
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
        processIceQueue();
      }
    });

    socket.on("receive_ice_candidate", async (data) => {
      const candidate = data.candidate;
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Ошибка добавления ICE", e);
        }
      } else {
        console.log("🧊 Кандидат пришел рано, добавляем в очередь");
        iceCandidatesQueue.current.push(candidate);
      }
    });

    socket.on("call_ended", () => {
      console.log("📴 Собеседник завершил звонок");
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
    if (!stream) {
      console.log("Не удалось получить стрим, отмена звонка");
      setCallState("idle");
      return;
    }

    const pc = createPeerConnection();
    peerConnection.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("call_user", {
      userToCall: userId,
      signalData: offer,
      from: currentUser.id,
      name: currentUser.username,
      isVideo: video,
    });
  };

  const answerCall = async () => {
    if (!socket || !otherUserId.current) {
        console.error("Нет сокета или ID звонящего");
        return;
    }

    console.log("Ответ на звонок. Получение медиа...");
    const stream = await getMediaStream(isVideoCall);
    
    if (!stream) {
        console.error("Отмена ответа: нет доступа к медиа");
        endCall(); 
        return;
    }

    const pc = createPeerConnection();
    peerConnection.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = pendingOffer.current;
    if (!offer) {
        console.error("Ошибка: Offer потерян");
        endCall();
        return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    processIceQueue();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    setCallState("connected");

    socket.emit("answer_call", {
      signal: answer,
      to: otherUserId.current,
    });
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
        callState,
        isVideoCall,
        localStream,
        remoteStream,
        callerData,
        startCall,
        answerCall,
        endCall,
        muteAudio,
        muteVideo,
        isAudioMuted,
        isVideoMuted,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};