import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { Socket } from "socket.io-client";
import { Device } from "mediasoup-client";
import type { Transport, Producer, Consumer } from "mediasoup-client/lib/types";
import { GroupCallParticipant } from "../types";

interface CallContextType {
  // 1-on-1 call
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
  // Group call
  groupCallState: "idle" | "active";
  groupCallChatId: number | null;
  groupCallParticipants: GroupCallParticipant[];
  groupCallIsVideo: boolean;
  joinGroupCall: (chatId: number, isVideo: boolean) => Promise<void>;
  leaveGroupCall: () => void;
  muteGroupAudio: () => void;
  muteGroupVideo: () => void;
  isGroupAudioMuted: boolean;
  isGroupVideoMuted: boolean;
  incomingGroupCall: { chatId: number; startedBy: { userId: number; username: string } } | null;
  dismissGroupCallBanner: () => void;
  /** The active 1-on-1 RTCPeerConnection, or null when no p2p call is connected */
  p2pPeerConnection: RTCPeerConnection | null;
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

  // ─── 1-on-1 call state ───────────────────────────────────────────────────
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

  // ─── Group call state ────────────────────────────────────────────────────
  const [groupCallState, setGroupCallState] = useState<"idle" | "active">("idle");
  const [groupCallChatId, setGroupCallChatId] = useState<number | null>(null);
  const [groupCallParticipants, setGroupCallParticipants] = useState<GroupCallParticipant[]>([]);
  const [groupCallIsVideo, setGroupCallIsVideo] = useState(false);
  const [isGroupAudioMuted, setIsGroupAudioMuted] = useState(false);
  const [isGroupVideoMuted, setIsGroupVideoMuted] = useState(false);
  const [incomingGroupCall, setIncomingGroupCall] = useState<{
    chatId: number;
    startedBy: { userId: number; username: string };
  } | null>(null);

  const mediasoupDeviceRef = useRef<Device | null>(null);
  const groupLocalStreamRef = useRef<MediaStream | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  // Map: producerId → { userId, stream }
  const remoteStreamsRef = useRef<Map<string, { userId: number; stream: MediaStream }>>(new Map());
  const groupChatIdRef = useRef<number | null>(null);
  // Guard against concurrent joinGroupCall invocations
  const isJoiningGroupRef = useRef(false);

  const resetGroupCall = useCallback(() => {
    groupLocalStreamRef.current?.getTracks().forEach((t) => t.stop());
    groupLocalStreamRef.current = null;
    sendTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current?.close();
    recvTransportRef.current = null;
    // Stop all remote streams before clearing to prevent media resource leaks
    remoteStreamsRef.current.forEach(({ stream }) => stream.getTracks().forEach((t) => t.stop()));
    remoteStreamsRef.current.clear();
    mediasoupDeviceRef.current = null;
    groupChatIdRef.current = null;
    isJoiningGroupRef.current = false;
    setGroupCallState("idle");
    setGroupCallChatId(null);
    setGroupCallParticipants([]);
    setGroupCallIsVideo(false);
    setIsGroupAudioMuted(false);
    setIsGroupVideoMuted(false);
  }, []);

  // ─── 1-on-1 helpers ──────────────────────────────────────────────────────
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
        socket.emit("send_ice_candidate", { to: otherUserId.current, candidate: event.candidate });
      }
    };
    pc.ontrack = (event) => {
      const incomingTrack = event.track;
      const incomingStream = event.streams[0];
      setRemoteStream((prev) => {
        if (incomingStream) return incomingStream;
        const newStream = new MediaStream();
        if (prev) prev.getTracks().forEach((t) => newStream.addTrack(t));
        newStream.addTrack(incomingTrack);
        return newStream;
      });
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        console.warn("ICE connection lost");
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
        } catch (e) {
          console.error("ICE candidate error:", e);
        }
      }
    }
  };

  const getMediaStream = async (video: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (err: any) {
      console.error("Media error (attempt 1):", err);
      if (video) {
        try {
          console.warn("Camera unavailable, falling back to audio-only");
          const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setLocalStream(audioStream);
          return audioStream;
        } catch (audioErr) {
          console.error("Microphone also unavailable:", audioErr);
        }
      }
      alert("Не удалось получить доступ к камере или микрофону.");
      resetCall();
      return null;
    }
  };

  // ─── Group call helpers ───────────────────────────────────────────────────
  const emitAsync = (eventName: string, data: object): Promise<any> => {
    return new Promise((resolve) => {
      if (!socket) return resolve({ error: "no socket" });
      (socket as any).emit(eventName, data, (res: any) => resolve(res));
    });
  };

  const updateParticipantsStream = (userId: number, stream: MediaStream | null) => {
    setGroupCallParticipants((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) {
        // Stop tracks of the old stream before replacing to prevent media resource leak
        if (existing.stream && existing.stream !== stream) {
          existing.stream.getTracks().forEach((t) => t.stop());
        }
        return prev.map((p) => (p.userId === userId ? { ...p, stream } : p));
      }
      return prev;
    });
  };

  const consumeProducer = useCallback(
    async (chatId: number, producerId: string, producerUserId: number) => {
      if (!mediasoupDeviceRef.current || !recvTransportRef.current) return;

      const res = await emitAsync("consume", {
        chatId,
        producerId,
        rtpCapabilities: mediasoupDeviceRef.current.rtpCapabilities,
      });

      if (!res || res.error) {
        console.error("consume error:", res?.error);
        return;
      }

      const { params } = res;
      let consumer: Consumer;
      try {
        consumer = await recvTransportRef.current.consume(params);
      } catch (e) {
        console.error("recvTransport.consume error:", e);
        return;
      }

      await emitAsync("consumer_resume", { chatId, consumerId: consumer.id });

      // Build/update MediaStream for this userId
      const existing = remoteStreamsRef.current.get(producerId);
      let mediaStream: MediaStream;
      if (existing) {
        mediaStream = existing.stream;
        mediaStream.addTrack(consumer.track);
      } else {
        mediaStream = new MediaStream([consumer.track]);
        remoteStreamsRef.current.set(producerId, { userId: producerUserId, stream: mediaStream });
      }

      updateParticipantsStream(producerUserId, mediaStream);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const joinGroupCall = useCallback(
    async (chatId: number, isVideo: boolean) => {
      if (!socket || !currentUser) return;
      if (groupCallState === "active") return; // already in a call
      if (isJoiningGroupRef.current) return; // prevent double-join race condition
      isJoiningGroupRef.current = true;

      try {
      setGroupCallIsVideo(isVideo);
      groupChatIdRef.current = chatId;

      // Step 1: Join the room, get existing participants list
      const joinRes = await emitAsync("group_call_join", {
        chatId,
        username: currentUser.username,
      });

      if (!joinRes || joinRes.error) {
        console.error("group_call_join error:", joinRes?.error);
        return;
      }

      const existingParticipants: { userId: number; username: string; producerIds: string[] }[] =
        joinRes.participants || [];

      // Set initial participant list (excluding self, no stream yet)
      setGroupCallParticipants(
        existingParticipants
          .filter((p) => p.userId !== currentUser.id)
          .map((p) => ({
            userId: p.userId,
            username: p.username,
            stream: null,
            audioMuted: false,
            videoMuted: false,
          }))
      );

      // Step 2: Get local media
      let localStream: MediaStream | null = null;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
      } catch (e) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch (e2) {
          console.error("Cannot access media:", e2);
          await emitAsync("group_call_leave", { chatId });
          return;
        }
      }
      groupLocalStreamRef.current = localStream;

      // Step 3: Load mediasoup Device with router RTP capabilities
      const capsRes = await emitAsync("get_rtp_capabilities", { chatId });
      if (!capsRes?.rtpCapabilities) {
        console.error("No RTP capabilities received");
        resetGroupCall();
        return;
      }

      let device: Device;
      try {
        device = new Device();
        await device.load({ routerRtpCapabilities: capsRes.rtpCapabilities });
      } catch (e) {
        console.error("Device load error:", e);
        resetGroupCall();
        return;
      }
      mediasoupDeviceRef.current = device;

      // Step 4: Create send transport
      const sendRes = await emitAsync("create_transport", { chatId, direction: "send" });
      if (!sendRes?.params) {
        console.error("No send transport params");
        resetGroupCall();
        return;
      }

      let sendTransport: Transport;
      try {
        sendTransport = device.createSendTransport(sendRes.params);
      } catch (e) {
        console.error("createSendTransport error:", e);
        resetGroupCall();
        return;
      }
      sendTransportRef.current = sendTransport;

      sendTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await emitAsync("connect_transport", {
            chatId,
            transportId: sendTransport.id,
            dtlsParameters,
          });
          callback();
        } catch (e: any) {
          errback(e);
        }
      });

      sendTransport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const res = await emitAsync("produce", { chatId, kind, rtpParameters });
          if (res?.error) { errback(new Error(res.error)); return; }
          callback({ id: res.producerId });
        } catch (e: any) {
          errback(e);
        }
      });

      // Produce audio track
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        try {
          await sendTransport.produce({ track: audioTrack });
        } catch (e) {
          console.error("produce audio error:", e);
        }
      }

      // Produce video track (if available)
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          await sendTransport.produce({ track: videoTrack });
        } catch (e) {
          console.error("produce video error:", e);
        }
      }

      // Step 5: Create recv transport
      const recvRes = await emitAsync("create_transport", { chatId, direction: "recv" });
      if (!recvRes?.params) {
        console.error("No recv transport params");
        resetGroupCall();
        return;
      }

      let recvTransport: Transport;
      try {
        recvTransport = device.createRecvTransport(recvRes.params);
      } catch (e) {
        console.error("createRecvTransport error:", e);
        resetGroupCall();
        return;
      }
      recvTransportRef.current = recvTransport;

      recvTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await emitAsync("connect_transport", {
            chatId,
            transportId: recvTransport.id,
            dtlsParameters,
          });
          callback();
        } catch (e: any) {
          errback(e);
        }
      });

      // Step 6: Consume all existing participants' producers
      for (const participant of existingParticipants) {
        if (participant.userId === currentUser.id) continue;
        for (const producerId of participant.producerIds) {
          await consumeProducer(chatId, producerId, participant.userId);
        }
      }

      setGroupCallState("active");
      setGroupCallChatId(chatId);
      setIncomingGroupCall(null);
      } finally {
        isJoiningGroupRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socket, currentUser, groupCallState, consumeProducer, resetGroupCall]
  );

  const leaveGroupCall = useCallback(() => {
    if (!socket || groupChatIdRef.current === null) return;
    socket.emit("group_call_leave", { chatId: groupChatIdRef.current });
    resetGroupCall();
  }, [socket, resetGroupCall]);

  const muteGroupAudio = () => {
    groupLocalStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsGroupAudioMuted((prev) => !prev);
  };

  const muteGroupVideo = () => {
    groupLocalStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsGroupVideoMuted((prev) => !prev);
  };

  const dismissGroupCallBanner = () => setIncomingGroupCall(null);

  // ─── Socket event listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // 1-on-1 call events
    socket.on("incoming_call", (data) => {
      if (callState !== "idle") return;
      setCallerData({ id: data.from, name: data.name });
      setIsVideoCall(data.isVideo);
      setCallState("incoming");
      otherUserId.current = data.from;
      pendingOffer.current = data.signal;
    });

    socket.on("call_accepted", async (signal) => {
      setCallState("connected");
      if (peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
          processIceQueue();
        } catch (e) {
          console.error("setRemoteDescription error:", e);
        }
      }
    });

    socket.on("receive_ice_candidate", async (data) => {
      const candidate = data.candidate;
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error(e);
        }
      } else {
        iceCandidatesQueue.current.push(candidate);
      }
    });

    socket.on("call_ended", () => {
      resetCall();
    });

    // Group call events
    socket.on("group_call_started", (data: { chatId: number; startedBy: { userId: number; username: string } }) => {
      // Show banner only if we're not already in a call
      if (groupCallState === "idle") {
        setIncomingGroupCall({ chatId: data.chatId, startedBy: data.startedBy });
      }
    });

    socket.on("group_call_participant_joined", async (data: { chatId: number; userId: number; username: string }) => {
      // Add participant to list (no stream yet)
      setGroupCallParticipants((prev) => {
        if (prev.find((p) => p.userId === data.userId)) return prev;
        return [
          ...prev,
          { userId: data.userId, username: data.username, stream: null, audioMuted: false, videoMuted: false },
        ];
      });
    });

    socket.on("new_producer", async (data: { chatId: number; producerId: string; userId: number }) => {
      if (groupCallState === "active" && groupChatIdRef.current === data.chatId) {
        await consumeProducer(data.chatId, data.producerId, data.userId);
      }
    });

    socket.on(
      "group_call_participant_left",
      (data: { chatId: number; userId: number; closedProducerIds: string[] }) => {
        // Remove their streams
        data.closedProducerIds.forEach((id) => remoteStreamsRef.current.delete(id));
        setGroupCallParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      }
    );

    socket.on("group_call_ended", (_data: { chatId: number }) => {
      resetGroupCall();
    });

    return () => {
      socket.off("incoming_call");
      socket.off("call_accepted");
      socket.off("receive_ice_candidate");
      socket.off("call_ended");
      socket.off("group_call_started");
      socket.off("group_call_participant_joined");
      socket.off("new_producer");
      socket.off("group_call_participant_left");
      socket.off("group_call_ended");
    };
  }, [socket, callState, groupCallState, resetCall, resetGroupCall, consumeProducer]);

  // ─── 1-on-1 call actions ─────────────────────────────────────────────────
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
        socket.emit("answer_call", { signal: answer, to: otherUserId.current });
      } catch (e) {
        console.error("answerCall error:", e);
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
      localStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
      setIsAudioMuted((prev) => !prev);
    }
  };

  const muteVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
      setIsVideoMuted((prev) => !prev);
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
        groupCallState,
        groupCallChatId,
        groupCallParticipants,
        groupCallIsVideo,
        joinGroupCall,
        leaveGroupCall,
        muteGroupAudio,
        muteGroupVideo,
        isGroupAudioMuted,
        isGroupVideoMuted,
        incomingGroupCall,
        dismissGroupCallBanner,
        p2pPeerConnection: peerConnection.current,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
