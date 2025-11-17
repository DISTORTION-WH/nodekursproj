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
    if (peerConnection.current) peerConnection.current.close();

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && otherUserId.current && socket) {
        socket.emit("send_ice_candidate", {
          to: otherUserId.current,
          candidate: event.candidate,
        });
      }
    };

    // ВАЖНО: Улучшенная обработка входящего потока
    pc.ontrack = (event) => {
      console.log("📡 Получен трек:", event.track.kind);
      
      // Иногда stream приходит пустым в event.streams, создаем новый если надо
      const stream = event.streams[0] || new MediaStream([event.track]);
      
      console.log("🔊 Аудио треков:", stream.getAudioTracks().length);
      console.log("📺 Видео треков:", stream.getVideoTracks().length);

      setRemoteStream(prevStream => {
         // Если поток уже есть, просто вернем его (чтобы не вызывать перерисовку)
         // Или можно объединить треки, если они приходят по отдельности
         if (prevStream && prevStream.id === stream.id) return prevStream;
         return stream;
      });
    };

    pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
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
            } catch (e) { console.error(e); }
        }
    }
  };

  const getMediaStream = async (video: boolean) => {
    try {
      // Всегда запрашиваем аудио!
      const stream = await navigator.mediaDevices.getUserMedia({ video: video, audio: true });
      
      console.log("🎤 Локальный доступ получен. Аудио треков:", stream.getAudioTracks().length);
      if (stream.getAudioTracks().length === 0) {
          alert("Внимание: Микрофон не найден или недоступен!");
      }

      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Error accessing media:", err);
      alert("Ошибка доступа к микрофону/камере. Проверьте разрешения браузера.");
      return null;
    }
  };

  useEffect(() => {
    if (!socket) return;

    socket.on("incoming_call", async (data) => {
      if (callState !== "idle") return;
      console.log("Incoming call from", data.name);
      setCallerData({ id: data.from, name: data.name });
      setIsVideoCall(data.isVideo);
      setCallState("incoming");
      otherUserId.current = data.from;
      pendingOffer.current = data.signal;
    });

    socket.on("call_accepted", async (signal) => {
      setCallState("connected");
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
        processIceQueue();
      }
    });

    socket.on("receive_ice_candidate", async (data) => {
      const candidate = data.candidate;
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate)); } 
        catch (e) { console.error(e); }
      } else {
        iceCandidatesQueue.current.push(candidate);
      }
    });

    socket.on("call_ended", () => resetCall());

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
    if (!socket || !otherUserId.current) return;
    
    // При ответе видео включаем, только если это был видеозвонок
    const stream = await getMediaStream(isVideoCall);
    if (!stream) { endCall(); return; }

    const pc = createPeerConnection();
    peerConnection.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    if (pendingOffer.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
        processIceQueue();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        setCallState("connected");
        socket.emit("answer_call", { signal: answer, to: otherUserId.current });
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
      value={{ callState, isVideoCall, localStream, remoteStream, callerData, startCall, answerCall, endCall, muteAudio, muteVideo, isAudioMuted, isVideoMuted }}
    >
      {children}
    </CallContext.Provider>
  );
};