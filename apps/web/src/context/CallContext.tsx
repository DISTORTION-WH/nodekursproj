import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { Socket } from "socket.io-client";
import { Device } from "mediasoup-client";
import type { Transport, Consumer } from "mediasoup-client/lib/types";
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

// Fallback STUN-only config (used if backend is unreachable)
const FALLBACK_ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

// Fetch fresh TURN credentials from backend (which proxies Metered API)
const fetchIceServers = async (): Promise<RTCConfiguration> => {
  try {
    const base = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
    const res = await fetch(`${base}/api/turn-credentials`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const servers = await res.json();
    console.log("[ICE] Got", servers.length, "ICE servers from backend");
    return { iceServers: servers, iceCandidatePoolSize: 10 };
  } catch (e) {
    console.warn("[ICE] Failed to fetch TURN credentials, using STUN only:", e);
    return FALLBACK_ICE;
  }
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
  const localStreamRef = useRef<MediaStream | null>(null);

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
  // Stable ref for socket to avoid stale closures
  const socketRef = useRef<Socket | null>(null);
  socketRef.current = socket;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Refs for call state — used in socket handlers to avoid stale closures
  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const groupCallStateRef = useRef(groupCallState);
  groupCallStateRef.current = groupCallState;

  // Stable refs for callbacks used in the socket effect
  // (so the effect only re-registers listeners when socket changes, not on every render)
  const resetCallRef = useRef<() => void>(() => {});
  const resetGroupCallRef = useRef<() => void>(() => {});
  const consumeProducerRef = useRef<(chatId: number, producerId: string, userId: number) => Promise<void>>(async () => {});

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
    // Use ref to avoid depending on localStream state (prevents effect re-registration)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.close();
    }
    setPeerConnection(null);
    setLocalStream(null);
    setRemoteStream(null);
    setCallState("idle");
    setCallerData(null);
    otherUserId.current = null;
    pendingOffer.current = null;
    iceCandidatesQueue.current = [];
    setIsAudioMuted(false);
    setIsVideoMuted(false);
  }, []); // stable — reads refs, no state deps

  // Track p2pPeerConnection as state so context consumers get updates
  const [p2pPcState, setP2pPcState] = useState<RTCPeerConnection | null>(null);

  const setPeerConnection = (pc: RTCPeerConnection | null) => {
    peerConnection.current = pc;
    setP2pPcState(pc);
  };

  const createPeerConnection = (iceConfig: RTCConfiguration) => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    console.log("[CALL] Creating PeerConnection with config:", JSON.stringify(iceConfig));
    const pc = new RTCPeerConnection(iceConfig);
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[CALL] ICE candidate:", event.candidate.type, event.candidate.protocol, event.candidate.address);
        // Use socketRef to avoid stale closure
        if (otherUserId.current && socketRef.current) {
          socketRef.current.emit("send_ice_candidate", { to: otherUserId.current, candidate: event.candidate });
        }
      } else {
        console.log("[CALL] ICE gathering complete");
      }
    };
    pc.ontrack = (event) => {
      console.log("[CALL] ontrack received:", event.track.kind, "readyState:", event.track.readyState);
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
      console.log("[CALL] ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.warn("[CALL] ICE connection FAILED — attempting ICE restart...");
        // Attempt ICE restart instead of giving up
        try {
          pc.restartIce();
        } catch (e) {
          console.error("[CALL] ICE restart failed:", e);
        }
      }
      if (pc.iceConnectionState === "disconnected") {
        console.warn("[CALL] ICE connection disconnected — may reconnect...");
      }
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        console.log("[CALL] ICE connection established successfully!");
      }
    };
    pc.onicegatheringstatechange = () => {
      console.log("[CALL] ICE gathering state:", pc.iceGatheringState);
    };
    pc.onsignalingstatechange = () => {
      console.log("[CALL] Signaling state:", pc.signalingState);
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

  const setLocalStreamBoth = (stream: MediaStream | null) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  };

  const getMediaStream = async (video: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      setLocalStreamBoth(stream);
      return stream;
    } catch (err: any) {
      console.error("Media error (attempt 1):", err);
      if (video) {
        try {
          console.warn("Camera unavailable, falling back to audio-only");
          const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setLocalStreamBoth(audioStream);
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
  const emitAsync = useCallback((eventName: string, data: object): Promise<any> => {
    return new Promise((resolve) => {
      const s = socketRef.current;
      if (!s) return resolve({ error: "no socket" });
      (s as any).emit(eventName, data, (res: any) => resolve(res));
    });
  }, []);

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
    [emitAsync]
  );

  // Keep stable refs in sync so socket effect handlers always call current version
  resetCallRef.current = resetCall;
  resetGroupCallRef.current = resetGroupCall;
  consumeProducerRef.current = consumeProducer;

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
        resetGroupCall();
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
          try {
            await consumeProducer(chatId, producerId, participant.userId);
          } catch (e) {
            console.error(`Failed to consume producer ${producerId} for user ${participant.userId}:`, e);
          }
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
      console.log("[CALL] incoming_call received:", data, "callState:", callStateRef.current, "groupCallState:", groupCallStateRef.current);
      // Use refs to read current state — avoids stale closure when effect hasn't re-run
      if (callStateRef.current !== "idle" || groupCallStateRef.current !== "idle") {
        // Already in a call — the server should have handled this with call_busy,
        // but as a safety net we silently ignore the incoming call
        console.log("[CALL] incoming_call ignored — already in a call");
        return;
      }
      setCallerData({ id: data.from, name: data.name });
      setIsVideoCall(data.isVideo);
      setCallState("incoming");
      otherUserId.current = data.from;
      pendingOffer.current = data.signal;
    });

    socket.on("call_busy", () => {
      // The person we called is busy — notify and reset
      alert("Пользователь сейчас занят другим звонком");
      resetCallRef.current();
    });

    socket.on("call_missed", () => {
      // Our outgoing call was declined by the other side
      resetCallRef.current();
    });

    socket.on("call_accepted", async (signal) => {
      try {
        console.log("[CALL] call_accepted received, setting remote description");
        setCallState("connected");
        if (peerConnection.current) {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
          console.log("[CALL] Remote description set, processing", iceCandidatesQueue.current.length, "queued ICE candidates");
          processIceQueue();
        } else {
          console.error("[CALL] call_accepted but no peerConnection!");
        }
      } catch (e) {
        console.error("call_accepted handler error:", e);
      }
    });

    socket.on("receive_ice_candidate", async (data) => {
      try {
        const candidate = data.candidate;
        console.log("[CALL] Received remote ICE candidate:", candidate?.type, candidate?.protocol, candidate?.address);
        if (peerConnection.current && peerConnection.current.remoteDescription) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          console.log("[CALL] Queuing ICE candidate (no remote description yet)");
          iceCandidatesQueue.current.push(candidate);
        }
      } catch (e) {
        console.error("receive_ice_candidate handler error:", e);
      }
    });

    socket.on("call_ended", () => {
      resetCallRef.current();
    });

    // Group call events
    socket.on("group_call_started", (data: { chatId: number; startedBy: { userId: number; username: string } }) => {
      // Show banner only if we're not already in a call — use ref to avoid stale closure
      if (groupCallStateRef.current === "idle" && callStateRef.current === "idle") {
        setIncomingGroupCall({ chatId: data.chatId, startedBy: data.startedBy });
      }
    });

    socket.on("group_call_participant_joined", async (data: { chatId: number; userId: number; username: string }) => {
      try {
        // Add participant to list (no stream yet)
        setGroupCallParticipants((prev) => {
          if (prev.find((p) => p.userId === data.userId)) return prev;
          return [
            ...prev,
            { userId: data.userId, username: data.username, stream: null, audioMuted: false, videoMuted: false },
          ];
        });
      } catch (e) {
        console.error("group_call_participant_joined handler error:", e);
      }
    });

    socket.on("new_producer", async (data: { chatId: number; producerId: string; userId: number }) => {
      try {
        if (groupCallStateRef.current === "active" && groupChatIdRef.current === data.chatId) {
          await consumeProducerRef.current(data.chatId, data.producerId, data.userId);
        }
      } catch (e) {
        console.error("new_producer handler error:", e);
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
      resetGroupCallRef.current();
    });

    return () => {
      socket.off("incoming_call");
      socket.off("call_accepted");
      socket.off("receive_ice_candidate");
      socket.off("call_ended");
      socket.off("call_busy");
      socket.off("call_missed");
      socket.off("group_call_started");
      socket.off("group_call_participant_joined");
      socket.off("new_producer");
      socket.off("group_call_participant_left");
      socket.off("group_call_ended");
    };
  // callState/groupCallState/resetCall removed from deps — handlers use refs instead
  // socket is the only real dep — re-register listeners only when socket changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ─── 1-on-1 call actions ─────────────────────────────────────────────────
  const startCall = async (userId: number, video: boolean) => {
    if (!socket || !currentUser) return;
    console.log("[CALL] startCall → userId:", userId, "from:", currentUser.id, "socket connected:", socket.connected);
    setIsVideoCall(video);
    otherUserId.current = userId;
    // Set callerData for the remote user so subtitle routing knows the remote userId
    setCallerData({ id: userId, name: "" });
    setCallState("calling");

    const [stream, iceConfig] = await Promise.all([getMediaStream(video), fetchIceServers()]);
    if (!stream) return;

    const pc = createPeerConnection(iceConfig);
    setPeerConnection(pc);
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

    const [stream, iceConfig] = await Promise.all([getMediaStream(isVideoCall), fetchIceServers()]);
    if (!stream) return;

    const pc = createPeerConnection(iceConfig);
    setPeerConnection(pc);
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
      if (callStateRef.current === "incoming") {
        // User is declining an incoming call — emit call_declined so caller is notified
        socket.emit("call_declined", { to: otherUserId.current });
      } else {
        socket.emit("end_call", { to: otherUserId.current });
      }
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
        p2pPeerConnection: p2pPcState,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
