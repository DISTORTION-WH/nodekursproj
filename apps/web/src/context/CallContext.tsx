import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { Socket } from "socket.io-client";
import { Device } from "mediasoup-client";
import type { Transport, Consumer } from "mediasoup-client/lib/types";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import { GroupCallParticipant } from "../types";
import { useI18n } from "../i18n";

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
  isScreenSharing: boolean;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  // Group call
  groupCallState: "idle" | "active";
  groupCallChatId: number | null;
  groupCallParticipants: GroupCallParticipant[];
  groupLocalStream: MediaStream | null;
  groupCallIsVideo: boolean;
  isGroupScreenSharing: boolean;
  joinGroupCall: (chatId: number, isVideo: boolean) => Promise<void>;
  leaveGroupCall: () => void;
  muteGroupAudio: () => void;
  muteGroupVideo: () => void;
  startGroupScreenShare: () => Promise<void>;
  stopGroupScreenShare: () => void;
  isGroupAudioMuted: boolean;
  isGroupVideoMuted: boolean;
  incomingGroupCall: { chatId: number; startedBy: { userId: number; username: string }; isVideo?: boolean } | null;
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

const CALL_RING_TIMEOUT_MS = Number(process.env.REACT_APP_CALL_RING_TIMEOUT_MS) || 45_000;

// Fetch fresh TURN credentials from backend (which proxies Metered API)
const fetchIceServers = async (): Promise<RTCConfiguration> => {
  try {
    const base = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
    const token = localStorage.getItem("token");
    const res = await fetch(`${base}/api/turn-credentials`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const servers = await res.json();
    console.log("[ICE] Got", servers.length, "ICE servers from backend");
    return { iceServers: servers, iceCandidatePoolSize: 10 };
  } catch (e) {
    console.warn("[ICE] Failed to fetch TURN credentials, using STUN only:", e);
    return FALLBACK_ICE;
  }
};

interface LiveKitConnectionInfo {
  enabled: boolean;
  url: string;
  token: string;
  roomName: string;
}

const fetchLiveKitConnectionInfo = async (chatId: number): Promise<LiveKitConnectionInfo | null> => {
  const base = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
  const token = localStorage.getItem("token");
  const res = await fetch(`${base}/api/livekit-token?chatId=${encodeURIComponent(String(chatId))}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (res.status === 404 || res.status === 501) return null;
  if (!res.ok) throw new Error(`LiveKit token request failed: HTTP ${res.status}`);

  const info = (await res.json()) as LiveKitConnectionInfo;
  return info?.enabled && info.url && info.token ? info : null;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocket() as { socket: Socket | null };
  const { currentUser } = useAuth();
  const { t } = useI18n();

  // ─── 1-on-1 call state ───────────────────────────────────────────────────
  const [callState, setCallState] = useState<"idle" | "incoming" | "connected" | "calling">("idle");
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callerData, setCallerData] = useState<{ id: number; name: string } | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const otherUserId = useRef<number | null>(null);
  const pendingOffer = useRef<any>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const outgoingCallTimerRef = useRef<number | null>(null);

  // ─── Group call state ────────────────────────────────────────────────────
  const [groupCallState, setGroupCallState] = useState<"idle" | "active">("idle");
  const [groupCallChatId, setGroupCallChatId] = useState<number | null>(null);
  const [groupCallParticipants, setGroupCallParticipants] = useState<GroupCallParticipant[]>([]);
  const [groupLocalStream, setGroupLocalStream] = useState<MediaStream | null>(null);
  const [groupCallIsVideo, setGroupCallIsVideo] = useState(false);
  const [isGroupScreenSharing, setIsGroupScreenSharing] = useState(false);
  const [isGroupAudioMuted, setIsGroupAudioMuted] = useState(false);
  const [isGroupVideoMuted, setIsGroupVideoMuted] = useState(false);
  const [incomingGroupCall, setIncomingGroupCall] = useState<{
    chatId: number;
    startedBy: { userId: number; username: string };
    isVideo?: boolean;
  } | null>(null);

  const mediasoupDeviceRef = useRef<Device | null>(null);
  const groupLocalStreamRef = useRef<MediaStream | null>(null);
  const liveKitRoomRef = useRef<Room | null>(null);
  const groupCallProviderRef = useRef<"livekit" | "mesh" | "legacy-mediasoup" | null>(null);
  const groupPeerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const groupIceQueuesRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
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
    const liveKitRoom = liveKitRoomRef.current;
    liveKitRoomRef.current = null;
    if (liveKitRoom && liveKitRoom.state !== "disconnected") {
      liveKitRoom.disconnect();
    }
    groupCallProviderRef.current = null;
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      screenStreamRef.current = null;
    }
    groupLocalStreamRef.current?.getTracks().forEach((t) => t.stop());
    groupLocalStreamRef.current = null;
    setGroupLocalStream(null);
    groupPeerConnectionsRef.current.forEach((pc) => pc.close());
    groupPeerConnectionsRef.current.clear();
    groupIceQueuesRef.current.clear();
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
    setIsGroupScreenSharing(false);
    setIsGroupAudioMuted(false);
    setIsGroupVideoMuted(false);
  }, []);

  // ─── 1-on-1 helpers ──────────────────────────────────────────────────────
  const resetCall = useCallback(() => {
    if (outgoingCallTimerRef.current !== null) {
      window.clearTimeout(outgoingCallTimerRef.current);
      outgoingCallTimerRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    // Use ref to avoid depending on localStream state (prevents effect re-registration)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.onconnectionstatechange = null;
      peerConnection.current.close();
    }
    setPeerConnection(null);
    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    setCallState("idle");
    setCallerData(null);
    otherUserId.current = null;
    pendingOffer.current = null;
    iceCandidatesQueue.current = [];
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
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
      const remote = remoteStreamRef.current ?? new MediaStream();
      const tracks = event.streams[0]?.getTracks().length
        ? event.streams[0].getTracks()
        : [event.track];

      tracks.forEach((track) => {
        if (!remote.getTracks().some((existing) => existing.id === track.id)) {
          remote.addTrack(track);
          track.onended = () => {
            remote.removeTrack(track);
            setRemoteStream(new MediaStream(remote.getTracks()));
          };
          track.onmute = () => setRemoteStream(new MediaStream(remote.getTracks()));
          track.onunmute = () => setRemoteStream(new MediaStream(remote.getTracks()));
        }
      });

      remoteStreamRef.current = remote;
      setRemoteStream(new MediaStream(remote.getTracks()));
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
    pc.onconnectionstatechange = () => {
      console.log("[CALL] Peer connection state:", pc.connectionState);
      if (pc.connectionState === "failed") {
        try {
          pc.restartIce();
        } catch (e) {
          console.error("[CALL] ICE restart failed:", e);
        }
      }
      if (pc.connectionState === "closed") {
        resetCallRef.current();
      }
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
      alert(t.call.media_access_error);
      resetCall();
      return null;
    }
  };

  // ─── Group call helpers ───────────────────────────────────────────────────
  const emitAsync = useCallback((eventName: string, data: object): Promise<any> => {
    return new Promise((resolve) => {
      const s = socketRef.current;
      if (!s) return resolve({ error: "no socket" });
      const timeoutId = window.setTimeout(() => resolve({ error: "socket ack timeout" }), 10_000);
      (s as any).emit(eventName, data, (res: any) => {
        window.clearTimeout(timeoutId);
        resolve(res);
      });
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

  const updateParticipantsScreenStream = (userId: number, screenStream: MediaStream | null) => {
    setGroupCallParticipants((prev) =>
      prev.map((p) =>
        p.userId === userId
          ? { ...p, screenStream, isScreenSharing: Boolean(screenStream) }
          : p
      )
    );
  };

  const addOrUpdateGroupParticipant = (userId: number, username: string, stream: MediaStream | null = null) => {
    setGroupCallParticipants((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) {
        return prev.map((p) => (p.userId === userId ? { ...p, username: username || p.username, stream: stream ?? p.stream } : p));
      }
      return [...prev, { userId, username, stream, audioMuted: false, videoMuted: false }];
    });
  };

  const getLiveKitUserId = (participant: RemoteParticipant): number | null => {
    const userId = Number(participant.identity);
    return Number.isFinite(userId) ? userId : null;
  };

  const getLiveKitUsername = (participant: RemoteParticipant): string => {
    if (participant.name) return participant.name;
    try {
      const metadata = participant.metadata ? JSON.parse(participant.metadata) : null;
      if (metadata?.username) return String(metadata.username);
    } catch {
      // Ignore invalid metadata from external clients.
    }
    return `User ${participant.identity}`;
  };

  const updateLiveKitParticipantMuteState = (userId: number, publication: RemoteTrackPublication) => {
    setGroupCallParticipants((prev) =>
      prev.map((p) => {
        if (p.userId !== userId) return p;
        if (publication.source === Track.Source.Microphone || publication.kind === Track.Kind.Audio) {
          return { ...p, audioMuted: publication.isMuted };
        }
        if (publication.source === Track.Source.Camera || publication.kind === Track.Kind.Video) {
          return { ...p, videoMuted: publication.isMuted };
        }
        return p;
      })
    );
  };

  const addLiveKitRemoteTrack = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    const userId = getLiveKitUserId(participant);
    if (userId === null) return;

    const isScreenTrack =
      publication.source === Track.Source.ScreenShare ||
      publication.source === Track.Source.ScreenShareAudio;
    const key = isScreenTrack ? `livekit_screen_${userId}` : `livekit_${userId}`;
    const stream = remoteStreamsRef.current.get(key)?.stream ?? new MediaStream();
    if (!stream.getTracks().some((t) => t.id === track.mediaStreamTrack.id)) {
      stream.addTrack(track.mediaStreamTrack);
    }
    remoteStreamsRef.current.set(key, { userId, stream });
    if (isScreenTrack) {
      addOrUpdateGroupParticipant(userId, getLiveKitUsername(participant));
      updateParticipantsScreenStream(userId, stream);
      return;
    }
    addOrUpdateGroupParticipant(userId, getLiveKitUsername(participant), stream);
    updateLiveKitParticipantMuteState(userId, publication);
  };

  const removeLiveKitRemoteTrack = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    const userId = getLiveKitUserId(participant);
    if (userId === null) return;
    const isScreenTrack =
      publication.source === Track.Source.ScreenShare ||
      publication.source === Track.Source.ScreenShareAudio;
    const key = isScreenTrack ? `livekit_screen_${userId}` : `livekit_${userId}`;
    const stream = remoteStreamsRef.current.get(key)?.stream;
    if (!stream) return;
    stream.removeTrack(track.mediaStreamTrack);
    if (stream.getTracks().length === 0) {
      remoteStreamsRef.current.delete(key);
      if (isScreenTrack) {
        updateParticipantsScreenStream(userId, null);
        return;
      }
      updateParticipantsStream(userId, null);
      return;
    }
    if (isScreenTrack) {
      updateParticipantsScreenStream(userId, stream);
      return;
    }
    updateParticipantsStream(userId, stream);
  };

  const processGroupIceQueue = async (userId: number) => {
    const pc = groupPeerConnectionsRef.current.get(userId);
    if (!pc || !pc.remoteDescription) return;
    const queue = groupIceQueuesRef.current.get(userId) ?? [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      if (!candidate) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("group ICE candidate error:", e);
      }
    }
    groupIceQueuesRef.current.delete(userId);
  };

  const createGroupPeerConnection = (chatId: number, peerUserId: number, iceConfig: RTCConfiguration) => {
    const existing = groupPeerConnectionsRef.current.get(peerUserId);
    if (existing) existing.close();

    const pc = new RTCPeerConnection(iceConfig);
    groupPeerConnectionsRef.current.set(peerUserId, pc);

    const baseStream = groupLocalStreamRef.current;
    if (baseStream) {
      const videoTracks = screenStreamRef.current?.getVideoTracks().length
        ? screenStreamRef.current.getVideoTracks()
        : baseStream.getVideoTracks();
      const publishTracks = [...baseStream.getAudioTracks(), ...videoTracks];
      const publishStream = new MediaStream(publishTracks);
      publishTracks.forEach((track) => {
        pc.addTrack(track, publishStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("group_call_ice_candidate", {
          chatId,
          to: peerUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = remoteStreamsRef.current.get(String(peerUserId))?.stream ?? new MediaStream();
      if (!stream.getTracks().some((track) => track.id === event.track.id)) {
        stream.addTrack(event.track);
      }
      remoteStreamsRef.current.set(String(peerUserId), { userId: peerUserId, stream });
      updateParticipantsStream(peerUserId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        groupPeerConnectionsRef.current.delete(peerUserId);
      }
    };

    return pc;
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

  const tryJoinLiveKitGroupCall = async (
    chatId: number,
    isVideo: boolean,
    activeUser: { id: number; username: string }
  ): Promise<boolean> => {
    const mode = process.env.REACT_APP_GROUP_CALL_MODE;
    if (mode === "mesh" || mode === "legacy-mediasoup") return false;

    let liveKitInfo: LiveKitConnectionInfo | null = null;
    try {
      liveKitInfo = await fetchLiveKitConnectionInfo(chatId);
    } catch (e) {
      console.warn("[LIVEKIT] Token fetch failed, falling back to mesh:", e);
      if (mode === "livekit") {
        alert(t.call.media_access_error);
        resetGroupCall();
        return true;
      }
      return false;
    }

    if (!liveKitInfo) return false;

    setGroupCallIsVideo(isVideo);
    groupChatIdRef.current = chatId;
    groupCallProviderRef.current = "livekit";

    let mediaStream: MediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
    } catch {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      } catch (mediaError) {
        console.error("Cannot access LiveKit group call media:", mediaError);
        alert(t.call.media_access_error);
        resetGroupCall();
        return true;
      }
    }

    groupLocalStreamRef.current = mediaStream;
    setGroupLocalStream(mediaStream);
    const hasLocalVideo = isVideo && mediaStream.getVideoTracks().length > 0;
    setGroupCallIsVideo(hasLocalVideo);

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    liveKitRoomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      const userId = getLiveKitUserId(participant);
      if (userId !== null) addOrUpdateGroupParticipant(userId, getLiveKitUsername(participant));
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      const userId = getLiveKitUserId(participant);
      if (userId === null) return;
      const key = `livekit_${userId}`;
      remoteStreamsRef.current.delete(key);
      remoteStreamsRef.current.delete(`livekit_screen_${userId}`);
      setGroupCallParticipants((prev) => prev.filter((p) => p.userId !== userId));
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      addLiveKitRemoteTrack(track, publication, participant);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      removeLiveKitRemoteTrack(track, publication, participant);
    });

    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (participant.identity === String(activeUser.id)) return;
      const userId = Number(participant.identity);
      if (Number.isFinite(userId)) updateLiveKitParticipantMuteState(userId, publication as RemoteTrackPublication);
    });

    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (participant.identity === String(activeUser.id)) return;
      const userId = Number(participant.identity);
      if (Number.isFinite(userId)) updateLiveKitParticipantMuteState(userId, publication as RemoteTrackPublication);
    });

    room.on(RoomEvent.Disconnected, () => {
      if (groupCallProviderRef.current !== "livekit" || liveKitRoomRef.current !== room) return;
      if (groupChatIdRef.current !== null) {
        socketRef.current?.emit("group_call_leave", { chatId: groupChatIdRef.current });
      }
      resetGroupCallRef.current();
    });

    try {
      await room.connect(liveKitInfo.url, liveKitInfo.token, {
        autoSubscribe: true,
      });

      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
      }
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera });
      }

      room.remoteParticipants.forEach((participant) => {
        const userId = getLiveKitUserId(participant);
        if (userId === null) return;
        addOrUpdateGroupParticipant(userId, getLiveKitUsername(participant));
        participant.trackPublications.forEach((publication) => {
          if (publication.track) {
            addLiveKitRemoteTrack(publication.track as RemoteTrack, publication, participant);
          }
          updateLiveKitParticipantMuteState(userId, publication);
        });
      });

      const joinRes = await emitAsync("group_call_join", {
        chatId,
        username: activeUser.username,
        isVideo: hasLocalVideo,
      });

      if (!joinRes || joinRes.error) {
        console.error("group_call_join error:", joinRes?.error);
        room.disconnect();
        resetGroupCall();
        return true;
      }

      const existingParticipants: { userId: number; username: string; audioMuted?: boolean; videoMuted?: boolean }[] =
        joinRes.participants || [];
      existingParticipants
        .filter((p) => p.userId !== activeUser.id)
        .forEach((p) => {
          addOrUpdateGroupParticipant(p.userId, p.username);
          setGroupCallParticipants((prev) =>
            prev.map((participant) =>
              participant.userId === p.userId
                ? {
                    ...participant,
                    audioMuted: Boolean(p.audioMuted),
                    videoMuted: Boolean(p.videoMuted),
                  }
                : participant
            )
          );
        });

      setGroupCallState("active");
      setGroupCallChatId(chatId);
      setIncomingGroupCall(null);
      return true;
    } catch (e) {
      console.error("[LIVEKIT] Join failed:", e);
      room.disconnect();
      resetGroupCall();
      if (mode === "livekit") {
        alert(t.call.media_access_error);
        return true;
      }
      return false;
    }
  };

  // Keep stable refs in sync so socket effect handlers always call current version
  resetCallRef.current = resetCall;
  resetGroupCallRef.current = resetGroupCall;
  consumeProducerRef.current = consumeProducer;

  const joinGroupCall = useCallback(
    async (chatId: number, isVideo: boolean) => {
      if (!socket || !currentUser) return;
      const activeUser = currentUser;
      if (groupCallState === "active") return; // already in a call
      if (isJoiningGroupRef.current) return; // prevent double-join race condition
      isJoiningGroupRef.current = true;

      try {
        if (process.env.REACT_APP_GROUP_CALL_MODE !== "legacy-mediasoup") {
        const joinedWithLiveKit = await tryJoinLiveKitGroupCall(chatId, isVideo, activeUser);
        if (joinedWithLiveKit) return;

        groupCallProviderRef.current = "mesh";
        setGroupCallIsVideo(isVideo);
        groupChatIdRef.current = chatId;

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        } catch {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          } catch (mediaError) {
            console.error("Cannot access group call media:", mediaError);
            alert(t.call.media_access_error);
            resetGroupCall();
            return;
          }
        }
        groupLocalStreamRef.current = mediaStream;
        setGroupLocalStream(mediaStream);
        setGroupCallIsVideo(isVideo && mediaStream.getVideoTracks().length > 0);

        const joinRes = await emitAsync("group_call_join", {
          chatId,
          username: activeUser.username,
          isVideo,
        });

        if (!joinRes || joinRes.error) {
          console.error("group_call_join error:", joinRes?.error);
          resetGroupCall();
          return;
        }

        const existingParticipants: { userId: number; username: string; audioMuted?: boolean; videoMuted?: boolean }[] = joinRes.participants || [];
        setGroupCallParticipants(
          existingParticipants
            .filter((p) => p.userId !== activeUser.id)
            .map((p) => ({
              userId: p.userId,
              username: p.username,
              stream: null,
              audioMuted: Boolean(p.audioMuted),
              videoMuted: Boolean(p.videoMuted),
            }))
        );

        setGroupCallState("active");
        setGroupCallChatId(chatId);
        setIncomingGroupCall(null);

        const iceConfig = await fetchIceServers();
        for (const participant of existingParticipants) {
          if (participant.userId === activeUser.id) continue;
          const pc = createGroupPeerConnection(chatId, participant.userId, iceConfig);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("group_call_offer", {
            chatId,
            to: participant.userId,
            signal: offer,
          });
        }
        return;
        }

      setGroupCallIsVideo(isVideo);
      groupCallProviderRef.current = "legacy-mediasoup";
      groupChatIdRef.current = chatId;

      // Step 1: Join the room, get existing participants list
      const joinRes = await emitAsync("group_call_join", {
        chatId,
        username: activeUser.username,
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
          .filter((p) => p.userId !== activeUser.id)
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
      if (!localStream) return;

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
      const audioTrack = localStream!.getAudioTracks()[0];
      if (audioTrack) {
        try {
          await sendTransport.produce({ track: audioTrack });
        } catch (e) {
          console.error("produce audio error:", e);
        }
      }

      // Produce video track (if available)
      const videoTrack = localStream!.getVideoTracks()[0];
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
        if (participant.userId === activeUser.id) continue;
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
    const next = !isGroupAudioMuted;
    groupLocalStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    if (groupCallProviderRef.current === "livekit") {
      liveKitRoomRef.current?.localParticipant.setMicrophoneEnabled(!next).catch(console.error);
    }
    setIsGroupAudioMuted(next);
    if (socketRef.current && groupChatIdRef.current !== null) {
      socketRef.current.emit("group_call_media_state", {
        chatId: groupChatIdRef.current,
        audioMuted: next,
        videoMuted: isGroupVideoMuted,
      });
    }
  };

  const muteGroupVideo = () => {
    const next = !isGroupVideoMuted;
    groupLocalStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    if (groupCallProviderRef.current === "livekit") {
      liveKitRoomRef.current?.localParticipant.setCameraEnabled(!next).catch(console.error);
    }
    setIsGroupVideoMuted(next);
    if (socketRef.current && groupChatIdRef.current !== null) {
      socketRef.current.emit("group_call_media_state", {
        chatId: groupChatIdRef.current,
        audioMuted: isGroupAudioMuted,
        videoMuted: next,
      });
    }
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
      alert(t.call.user_busy);
      resetCallRef.current();
    });

    socket.on("call_error", (data?: { message?: string }) => {
      if (data?.message) alert(data.message);
      resetCallRef.current();
    });

    socket.on("call_missed", () => {
      // Our outgoing call was declined by the other side
      resetCallRef.current();
    });

    socket.on("call_accepted", async (signal) => {
      try {
        console.log("[CALL] call_accepted received, setting remote description");
        if (peerConnection.current) {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
          if (outgoingCallTimerRef.current !== null) {
            window.clearTimeout(outgoingCallTimerRef.current);
            outgoingCallTimerRef.current = null;
          }
          setCallState("connected");
          console.log("[CALL] Remote description set, processing", iceCandidatesQueue.current.length, "queued ICE candidates");
          processIceQueue();
        } else {
          console.error("[CALL] call_accepted but no peerConnection!");
          resetCallRef.current();
        }
      } catch (e) {
        console.error("call_accepted handler error:", e);
        resetCallRef.current();
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
    socket.on("group_call_started", (data: { chatId: number; startedBy: { userId: number; username: string }; isVideo?: boolean }) => {
      // Show banner only if we're not already in a call — use ref to avoid stale closure
      if (groupCallStateRef.current === "idle" && callStateRef.current === "idle") {
        setIncomingGroupCall({ chatId: data.chatId, startedBy: data.startedBy, isVideo: data.isVideo });
      }
    });

    socket.on("group_call_participant_joined", async (data: { chatId: number; userId: number; username: string; audioMuted?: boolean; videoMuted?: boolean }) => {
      try {
        // Add participant to list (no stream yet)
        setGroupCallParticipants((prev) => {
          if (prev.find((p) => p.userId === data.userId)) return prev;
          return [
            ...prev,
            { userId: data.userId, username: data.username, stream: null, audioMuted: Boolean(data.audioMuted), videoMuted: Boolean(data.videoMuted) },
          ];
        });
      } catch (e) {
        console.error("group_call_participant_joined handler error:", e);
      }
    });

    socket.on("group_call_offer", async (data: { chatId: number; from: number; username?: string; signal: RTCSessionDescriptionInit }) => {
      try {
        if (groupCallStateRef.current !== "active" || groupChatIdRef.current !== data.chatId) return;
        addOrUpdateGroupParticipant(data.from, data.username || `User ${data.from}`);
        const iceConfig = await fetchIceServers();
        const pc = createGroupPeerConnection(data.chatId, data.from, iceConfig);
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        await processGroupIceQueue(data.from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("group_call_answer", { chatId: data.chatId, to: data.from, signal: answer });
      } catch (e) {
        console.error("group_call_offer handler error:", e);
      }
    });

    socket.on("group_call_answer", async (data: { chatId: number; from: number; signal: RTCSessionDescriptionInit }) => {
      try {
        if (groupCallStateRef.current !== "active" || groupChatIdRef.current !== data.chatId) return;
        const pc = groupPeerConnectionsRef.current.get(data.from);
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        await processGroupIceQueue(data.from);
      } catch (e) {
        console.error("group_call_answer handler error:", e);
      }
    });

    socket.on("group_call_ice_candidate", async (data: { chatId: number; from: number; candidate: RTCIceCandidateInit }) => {
      try {
        if (groupCallStateRef.current !== "active" || groupChatIdRef.current !== data.chatId) return;
        const pc = groupPeerConnectionsRef.current.get(data.from);
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          const queue = groupIceQueuesRef.current.get(data.from) ?? [];
          queue.push(data.candidate);
          groupIceQueuesRef.current.set(data.from, queue);
        }
      } catch (e) {
        console.error("group_call_ice_candidate handler error:", e);
      }
    });

    socket.on("group_call_media_state", (data: { chatId: number; userId: number; audioMuted: boolean; videoMuted: boolean }) => {
      if (groupChatIdRef.current !== data.chatId) return;
      setGroupCallParticipants((prev) =>
        prev.map((p) =>
          p.userId === data.userId
            ? { ...p, audioMuted: data.audioMuted, videoMuted: data.videoMuted }
            : p
        )
      );
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
      (data: { chatId: number; userId: number; closedProducerIds?: string[] }) => {
        if (groupChatIdRef.current !== data.chatId) return;
        data.closedProducerIds?.forEach((id) => remoteStreamsRef.current.delete(id));
        const remote = remoteStreamsRef.current.get(String(data.userId));
        remote?.stream.getTracks().forEach((track) => track.stop());
        remoteStreamsRef.current.delete(String(data.userId));
        remoteStreamsRef.current.delete(`livekit_screen_${data.userId}`);
        groupPeerConnectionsRef.current.get(data.userId)?.close();
        groupPeerConnectionsRef.current.delete(data.userId);
        groupIceQueuesRef.current.delete(data.userId);
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
      socket.off("call_error");
      socket.off("call_missed");
      socket.off("group_call_started");
      socket.off("group_call_participant_joined");
      socket.off("group_call_offer");
      socket.off("group_call_answer");
      socket.off("group_call_ice_candidate");
      socket.off("group_call_media_state");
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
    if (callStateRef.current !== "idle" || groupCallStateRef.current !== "idle") return;
    console.log("[CALL] startCall → userId:", userId, "from:", currentUser.id, "socket connected:", socket.connected);
    setIsVideoCall(video);
    otherUserId.current = userId;
    // Set callerData for the remote user so subtitle routing knows the remote userId
    setCallerData({ id: userId, name: "" });
    setCallState("calling");

    const [stream, iceConfig] = await Promise.all([getMediaStream(video), fetchIceServers()]);
    if (!stream) return;

    try {
      const pc = createPeerConnection(iceConfig);
      setPeerConnection(pc);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (outgoingCallTimerRef.current !== null) {
        window.clearTimeout(outgoingCallTimerRef.current);
      }
      outgoingCallTimerRef.current = window.setTimeout(() => {
        if (callStateRef.current === "calling") {
          socket.emit("end_call", { to: userId });
          resetCallRef.current();
        }
      }, CALL_RING_TIMEOUT_MS);

      socket.emit("call_user", {
        userToCall: userId,
        signalData: offer,
        from: currentUser.id,
        name: currentUser.username,
        isVideo: video,
      });
    } catch (e) {
      console.error("startCall error:", e);
      resetCall();
    }
  };

  const answerCall = async () => {
    if (!socket || !otherUserId.current) return;
    const callerId = otherUserId.current;

    const [stream, iceConfig] = await Promise.all([getMediaStream(isVideoCall), fetchIceServers()]);
    if (!stream) {
      socket.emit("call_declined", { to: callerId });
      resetCall();
      return;
    }

    const pc = createPeerConnection(iceConfig);
    setPeerConnection(pc);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    if (pendingOffer.current) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
        processIceQueue();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer_call", { signal: answer, to: callerId });
        setCallState("connected");
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

  const stopScreenShare = useCallback(() => {
    const pc = peerConnection.current;
    const screenStream = screenStreamRef.current;
    if (!screenStream) return;

    const screenVideoTrack = screenStream.getVideoTracks()[0] ?? null;
    screenStreamRef.current = null;
    screenStream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });

    const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    const sender = pc?.getSenders().find((s) =>
      s.track?.kind === "video" || (screenVideoTrack !== null && s.track?.id === screenVideoTrack.id)
    );
    if (sender) sender.replaceTrack(camTrack).catch(console.error);
    setLocalStream(localStreamRef.current);
    setIsScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    const pc = peerConnection.current;
    if (!pc || !localStreamRef.current || !isVideoCall) return;

    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) {
      console.warn("[SCREEN] Cannot start screen share: no negotiated video sender");
      return;
    }

    try {
      if (screenStreamRef.current) stopScreenShare();
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoTrack = screenStream.getVideoTracks()[0];
      if (!videoTrack) {
        screenStream.getTracks().forEach((track) => track.stop());
        return;
      }

      await sender.replaceTrack(videoTrack);
      screenStreamRef.current = screenStream;
      setLocalStream(new MediaStream([
        ...localStreamRef.current.getAudioTracks(),
        videoTrack,
      ]));
      setIsScreenSharing(true);
      videoTrack.onended = () => stopScreenShare();
    } catch (e) {
      console.error("[SCREEN] Share error:", e);
      stopScreenShare();
    }
  }, [isVideoCall, stopScreenShare]);

  const stopGroupScreenShare = useCallback(() => {
    const screenStream = screenStreamRef.current;
    if (!screenStream) return;

    const screenVideoTrack = screenStream.getVideoTracks()[0] ?? null;
    screenStreamRef.current = null;
    screenStream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });

    if (groupCallProviderRef.current === "livekit") {
      liveKitRoomRef.current?.localParticipant.setScreenShareEnabled(false).catch(console.error);
    } else {
      const camTrack = groupLocalStreamRef.current?.getVideoTracks()[0] ?? null;
      groupPeerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) =>
          s.track?.kind === "video" || (screenVideoTrack !== null && s.track?.id === screenVideoTrack.id)
        );
        if (sender) sender.replaceTrack(camTrack).catch(console.error);
      });
    }

    setGroupLocalStream(groupLocalStreamRef.current);
    setIsGroupScreenSharing(false);
  }, []);

  const startGroupScreenShare = useCallback(async () => {
    if (groupCallStateRef.current !== "active" || !groupCallIsVideo || !groupLocalStreamRef.current) return;

    try {
      if (screenStreamRef.current) stopGroupScreenShare();

      if (groupCallProviderRef.current === "livekit") {
        const publication = await liveKitRoomRef.current?.localParticipant.setScreenShareEnabled(true, {
          audio: false,
        });
        const videoTrack = publication?.track?.mediaStreamTrack;
        if (!videoTrack) return;

        const screenStream = new MediaStream([videoTrack]);
        screenStreamRef.current = screenStream;
        setGroupLocalStream(new MediaStream([
          ...groupLocalStreamRef.current.getAudioTracks(),
          videoTrack,
        ]));
        setIsGroupScreenSharing(true);
        videoTrack.onended = () => stopGroupScreenShare();
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoTrack = screenStream.getVideoTracks()[0];
      if (!videoTrack) {
        screenStream.getTracks().forEach((track) => track.stop());
        return;
      }

      screenStreamRef.current = screenStream;
      groupPeerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(videoTrack).catch(console.error);
      });
      setGroupLocalStream(new MediaStream([
        ...groupLocalStreamRef.current.getAudioTracks(),
        videoTrack,
      ]));
      setIsGroupScreenSharing(true);
      videoTrack.onended = () => stopGroupScreenShare();
    } catch (e) {
      console.error("[GROUP-SCREEN] Share error:", e);
      stopGroupScreenShare();
    }
  }, [groupCallIsVideo, stopGroupScreenShare]);

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
        groupLocalStream,
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
        isScreenSharing,
        startScreenShare,
        stopScreenShare,
        isGroupScreenSharing,
        startGroupScreenShare,
        stopGroupScreenShare,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
