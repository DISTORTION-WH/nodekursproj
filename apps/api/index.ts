import dotenv from "dotenv";
import path from "path";
// Инициализация переменных окружения ДО всего остального
// Try local .env first, then fall back to monorepo root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import http from "http";
import { Server, Socket } from "socket.io";
import client from "./databasepg"; 
import bcrypt from "bcryptjs"; 
import jwt from "jsonwebtoken"; 
import { secret } from "./config"; 
import { AccessToken } from "livekit-server-sdk";

import authRouter from "./Routes/authRouter";
import chatRouter from "./Routes/chatRouter";
import usersRouter from "./Routes/usersRouter";
import friendsRouter from "./Routes/friendsRouter";
import adminRouter from "./Routes/adminRouter";
import moderatorRouter from "./Routes/moderatorRouter";
import authMiddleware from "./middleware/authMiddleware";
import logger from "./Services/logService";
import * as deepgramService from "./Services/deepgramService";
import { translateText as deeplTranslate } from "./Services/deeplService";

const mediasoupService = {
  isRoomActive: (_chatId: number) => false,
  joinRoom: async (_chatId: number, _userId: number, _socketId: string, _username: string) => undefined,
  getParticipants: (_chatId: number) => [],
  getRtpCapabilities: (_chatId: number) => null,
  createWebRtcTransport: async (_chatId: number, _userId: number, _direction: "send" | "recv"): Promise<any> => {
    throw new Error("Legacy mediasoup transport is disabled on this deployment");
  },
  connectTransport: async (_chatId: number, _userId: number, _transportId: string, _dtlsParameters: object) => undefined,
  produce: async (_chatId: number, _userId: number, _kind: "audio" | "video", _rtpParameters: object): Promise<any> => {
    throw new Error("Legacy mediasoup producer is disabled on this deployment");
  },
  consume: async (_chatId: number, _userId: number, _producerId: string, _rtpCapabilities: object): Promise<any> => null,
  resumeConsumer: async (_chatId: number, _userId: number, _consumerId: string) => undefined,
  leaveRoom: (_chatId: number, _userId: number) => [] as string[],
};

const AUTO_MODERATOR_NAME = "USER2"; 

process.on("uncaughtException", (err: Error, origin: string) => {
  logger.error(`UNCAUGHT EXCEPTION at ${origin}`, err).finally(() => {
    process.exit(1);
  });
});

process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error(
    "UNHANDLED REJECTION",
    reason instanceof Error ? reason : { reason }
  );
});

const PORT = process.env.PORT || 5000;

const app = express();

// Allowed CORS origins — configure via env vars, no hardcoded domains
const parseCsvEnv = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const allowedOrigins = Array.from(new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  ...parseCsvEnv(process.env.ALLOWED_ORIGINS),
].filter(Boolean) as string[]));

const vercelPreviewSuffix = process.env.VERCEL_PREVIEW_SUFFIX || "";
const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (!vercelPreviewSuffix) return false;
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "https:" && hostname.endsWith(vercelPreviewSuffix);
  } catch {
    return false;
  }
};

const corsOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  if (isAllowedOrigin(origin)) return callback(null, true);
  console.log(`CORS blocked: ${origin}`);
  return callback(new Error("Not allowed by CORS"));
};

app.use(
  cors({
    origin: corsOrigin,
      // Разрешаем запросы без origin (например, мобильные приложения или curl)
    credentials: true,
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

interface AuthenticatedSocket extends Socket {
  userId: number;
}

// WebRTC signaling types (browser DOM types not available in Node)
interface RTCSessionDescriptionInit {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}
interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface SocketJwtPayload {
  id: number;
  role: string;
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) return next(new Error("Authentication error: no token"));

    const decoded = jwt.verify(token, secret) as SocketJwtPayload;
    if (typeof decoded.id !== "number") return next(new Error("Authentication error: invalid token"));

    const userRes = await client.query<{ is_banned: boolean }>("SELECT is_banned FROM users WHERE id = $1", [decoded.id]);
    if (userRes.rows.length === 0) return next(new Error("Authentication error: user not found"));
    if (userRes.rows[0].is_banned) {
      console.log(`Rejected socket connection from banned user: ${decoded.id}`);
      return next(new Error("User is banned"));
    }

    (socket as AuthenticatedSocket).userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

// Track users currently in a 1-on-1 call (userId → otherUserId)
const usersInCall = new Map<number, number>();
const callTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
const CALL_RING_TIMEOUT_MS = Number(process.env.CALL_RING_TIMEOUT_MS) || 45_000;

interface GroupCallParticipant {
  userId: number;
  socketId: string;
  username: string;
  audioMuted: boolean;
  videoMuted: boolean;
  isVideo: boolean;
}

interface GroupCallRoom {
  chatId: number;
  participants: Map<number, GroupCallParticipant>;
}

const groupCallRooms = new Map<number, GroupCallRoom>();

function getGroupCallRoom(chatId: number): GroupCallRoom {
  let room = groupCallRooms.get(chatId);
  if (!room) {
    room = { chatId, participants: new Map() };
    groupCallRooms.set(chatId, room);
  }
  return room;
}

function getGroupCallParticipants(chatId: number): GroupCallParticipant[] {
  return Array.from(groupCallRooms.get(chatId)?.participants.values() ?? []);
}

function isGroupCallParticipant(chatId: number, userId: number): boolean {
  return groupCallRooms.get(chatId)?.participants.has(userId) ?? false;
}

function getUserGroupCallChatIds(userId: number): number[] {
  const chatIds: number[] = [];
  for (const [chatId, room] of groupCallRooms.entries()) {
    if (room.participants.has(userId)) chatIds.push(chatId);
  }
  return chatIds;
}

function isUserInGroupCall(userId: number): boolean {
  return getUserGroupCallChatIds(userId).length > 0;
}

function hasActiveSocket(userId: number): boolean {
  return (io.sockets.adapter.rooms.get(`user_${userId}`)?.size ?? 0) > 0;
}

function isP2PPair(userId: number, otherUserId: number): boolean {
  return usersInCall.get(userId) === otherUserId && usersInCall.get(otherUserId) === userId;
}

function clearCallTimeout(userId: number) {
  const timeout = callTimeouts.get(userId);
  if (timeout) clearTimeout(timeout);
  callTimeouts.delete(userId);
}

function clearP2PCall(userId: number, otherUserId?: number) {
  const peerId = otherUserId ?? usersInCall.get(userId);
  clearCallTimeout(userId);
  usersInCall.delete(userId);
  if (peerId !== undefined) {
    clearCallTimeout(peerId);
    usersInCall.delete(peerId);
  }
}

function scheduleRingTimeout(callerId: number, targetId: number) {
  const timeout = setTimeout(() => {
    if (!isP2PPair(callerId, targetId)) return;
    clearP2PCall(callerId, targetId);
    io.to(`user_${callerId}`).emit("call_missed", { to: targetId, reason: "timeout" });
    io.to(`user_${targetId}`).emit("call_ended", { reason: "timeout" });
  }, CALL_RING_TIMEOUT_MS);
  callTimeouts.set(callerId, timeout);
  callTimeouts.set(targetId, timeout);
}

function joinGroupCallRoom(chatId: number, participant: GroupCallParticipant): {
  existingParticipants: GroupCallParticipant[];
  isFirstParticipant: boolean;
} {
  const room = getGroupCallRoom(chatId);
  const existingParticipants = Array.from(room.participants.values()).filter(
    (p) => p.userId !== participant.userId
  );
  room.participants.set(participant.userId, participant);
  return {
    existingParticipants,
    isFirstParticipant: existingParticipants.length === 0,
  };
}

function leaveGroupCallRoom(chatId: number, userId: number): boolean {
  const room = groupCallRooms.get(chatId);
  if (!room) return false;
  const removed = room.participants.delete(userId);
  if (room.participants.size === 0) {
    groupCallRooms.delete(chatId);
  }
  return removed;
}

function leaveAllGroupCallRooms(userId: number): number[] {
  const affectedChatIds: number[] = [];
  for (const [chatId, room] of groupCallRooms.entries()) {
    if (room.participants.has(userId)) {
      room.participants.delete(userId);
      affectedChatIds.push(chatId);
      if (room.participants.size === 0) {
        groupCallRooms.delete(chatId);
      }
    }
  }
  return affectedChatIds;
}

// Rate limiting: call_user — max 5 attempts per user per 60s
const callRateLimit = new Map<number, { count: number; resetAt: number }>();
function checkCallRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = callRateLimit.get(userId);
  if (!entry || now > entry.resetAt) {
    callRateLimit.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

io.on("connection", async (socket: Socket) => {
  console.log("Socket connected:", socket.id);
  const authSocket = socket as AuthenticatedSocket;
  const connectedUserId = authSocket.userId;
  if (connectedUserId) {
    // Auto-join user's personal room on connect — don't rely on client event
    socket.join(`user_${connectedUserId}`);
    console.log(`[SOCKET] User ${connectedUserId} auto-joined room user_${connectedUserId}`);
    try {
      // Check if user is in invisible mode
      const invisibleRes = await client.query("SELECT is_invisible FROM users WHERE id = $1", [connectedUserId]);
      const isInvisible = invisibleRes.rows[0]?.is_invisible === true;

      const userRoomsRes = await client.query("SELECT chat_id FROM chat_users WHERE user_id = $1", [connectedUserId]);
      for (const row of userRoomsRes.rows) {
        socket.join(`chat_${row.chat_id}`);
      }

      if (!isInvisible) {
        await client.query("UPDATE users SET status = 'online' WHERE id = $1", [connectedUserId]);
        for (const row of userRoomsRes.rows) {
          io.to(`chat_${row.chat_id}`).emit("user_status_changed", { userId: connectedUserId, status: "online" });
        }
        // Also notify friends who may not share a chat yet
        const friendsRes = await client.query(
          "SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS friend_id FROM friends WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'",
          [connectedUserId]
        );
        for (const row of friendsRes.rows) {
          io.to(`user_${row.friend_id}`).emit("user_status_changed", { userId: connectedUserId, status: "online" });
        }
      }
    } catch (e) {
      console.error("Error updating online status:", e);
    }
  }

  // Keep for backwards compatibility — only allow joining own room
  socket.on("join_user_room", (userId: string | number) => {
    if (Number(userId) === connectedUserId) {
      socket.join(`user_${connectedUserId}`);
    }
  });

  socket.on("join_chat", async (chatId: string | number) => {
    try {
      const memberCheck = await client.query(
        "SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2",
        [chatId, connectedUserId]
      );
      if (memberCheck.rows.length > 0) {
        socket.join(`chat_${chatId}`);
      }
    } catch {
      // silently ignore DB errors for socket room join
    }
  });

  socket.on("leave_chat", (chatId: string | number) => {
    socket.leave(`chat_${chatId}`);
  });

  socket.on("call_user", async (data: { userToCall: number; signalData: RTCSessionDescriptionInit; from: number; name: string; isVideo: boolean }) => {
    const callerUserId = authSocket.userId;
    const targetId = Number(data.userToCall);
    const fromId = Number(data.from);

    // Rate limit: max 5 call attempts per minute
    if (!checkCallRateLimit(callerUserId)) {
      socket.emit("call_error", { message: "Слишком много звонков. Подождите минуту." });
      return;
    }

    // Prevent spoofing — from must equal authenticated caller
    if (fromId !== callerUserId) {
      socket.emit("call_error", { message: "Некорректные данные звонка" });
      return;
    }

    console.log(`[CALL] call_user: from=${fromId} (socket userId=${callerUserId}) → to=${targetId}`);

    if (!Number.isFinite(targetId) || targetId === callerUserId) {
      socket.emit("call_error", { message: "Invalid call target" });
      return;
    }

    try {
      const targetRes = await client.query<{ is_banned: boolean }>(
        "SELECT is_banned FROM users WHERE id = $1",
        [targetId]
      );
      if (targetRes.rows.length === 0 || targetRes.rows[0].is_banned) {
        socket.emit("call_error", { message: "User is unavailable" });
        return;
      }
    } catch (e) {
      console.error("[CALL] target lookup failed:", e);
      socket.emit("call_error", { message: "Call failed" });
      return;
    }

    if (!hasActiveSocket(targetId)) {
      socket.emit("call_missed", { to: targetId, reason: "offline" });
      return;
    }

    // If either side is already in a 1-on-1 or group call, notify caller.
    if (
      usersInCall.has(callerUserId) ||
      usersInCall.has(targetId) ||
      isUserInGroupCall(callerUserId) ||
      isUserInGroupCall(targetId)
    ) {
      console.log(`[CALL] User ${targetId} is busy, usersInCall:`, [...usersInCall.entries()]);
      socket.emit("call_busy", { userId: targetId });
      return;
    }
    // Mark both users as in a call
    usersInCall.set(fromId, targetId);
    usersInCall.set(targetId, fromId);
    scheduleRingTimeout(fromId, targetId);

    const targetRoom = `user_${targetId}`;
    const roomSockets = io.sockets.adapter.rooms.get(targetRoom);
    console.log(`[CALL] Emitting incoming_call to room ${targetRoom}, sockets in room: ${roomSockets ? [...roomSockets].join(', ') : 'NONE'}`);

    io.to(targetRoom).emit("incoming_call", {
      signal: data.signalData,
      from: fromId,
      name: data.name,
      isVideo: data.isVideo
    });
  });

  socket.on("answer_call", (data: { to: number; signal: RTCSessionDescriptionInit }) => {
    const userId = authSocket.userId;
    const callerId = Number(data.to);
    if (!userId || !Number.isFinite(callerId) || !isP2PPair(userId, callerId)) return;
    clearCallTimeout(userId);
    clearCallTimeout(callerId);
    io.to(`user_${callerId}`).emit("call_accepted", data.signal);
  });

  socket.on("send_ice_candidate", (data: { to: number; candidate: RTCIceCandidateInit }) => {
    const userId = authSocket.userId;
    const targetId = Number(data.to);
    if (!userId || !Number.isFinite(targetId) || !isP2PPair(userId, targetId)) return;
    io.to(`user_${targetId}`).emit("receive_ice_candidate", { candidate: data.candidate });
  });

  socket.on("end_call", (data: { to: number }) => {
    const userId = authSocket.userId;
    const targetId = Number(data.to);
    if (!userId || !Number.isFinite(targetId) || !isP2PPair(userId, targetId)) return;
    // Clean up busy tracking
    clearP2PCall(userId, targetId);
    io.to(`user_${targetId}`).emit("call_ended");
  });

  socket.on("call_declined", (data: { to: number }) => {
    const userId = authSocket.userId;
    const targetId = Number(data.to);
    if (!userId || !Number.isFinite(targetId) || !isP2PPair(userId, targetId)) return;
    // Clean up busy tracking
    clearP2PCall(userId, targetId);
    // Notify caller that the call was declined (missed call)
    io.to(`user_${targetId}`).emit("call_missed", { from: userId, reason: "declined" });
  });

  socket.on("group_call_join", async (data: { chatId: number; username: string; isVideo?: boolean }, ack) => {
    const userId = authSocket.userId;
    const chatId = Number(data.chatId);
    if (!userId || !Number.isFinite(chatId)) return;
    try {
      if (usersInCall.has(userId)) {
        if (ack) ack({ error: "User is busy with another call" });
        return;
      }

      const otherGroupCalls = getUserGroupCallChatIds(userId).filter((id) => id !== chatId);
      if (otherGroupCalls.length > 0) {
        if (ack) ack({ error: "User is already in another group call" });
        return;
      }

      const memberCheck = await client.query(
        "SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2",
        [chatId, userId]
      );
      if (memberCheck.rows.length === 0) {
        if (ack) ack({ error: "Нет доступа к чату" });
        return;
      }

      const username = String(data.username || `User ${userId}`).slice(0, 80);
      const { existingParticipants, isFirstParticipant } = joinGroupCallRoom(chatId, {
        userId,
        socketId: socket.id,
        username,
        audioMuted: false,
        videoMuted: false,
        isVideo: Boolean(data.isVideo),
      });
      socket.join(`call_${chatId}`);

      if (isFirstParticipant) {
        socket.to(`chat_${chatId}`).emit("group_call_started", {
          chatId,
          startedBy: { userId, username },
          isVideo: Boolean(data.isVideo),
        });
      } else {
        socket.to(`call_${chatId}`).emit("group_call_participant_joined", {
          chatId,
          userId,
          username,
          audioMuted: false,
          videoMuted: false,
        });
      }

      if (ack) ack({ participants: existingParticipants });
    } catch (e) {
      console.error("group_call_join error:", e);
      if (ack) ack({ error: "Ошибка входа в звонок" });
    }
  });

  socket.on("group_call_offer", (data: { chatId: number; to: number; signal: RTCSessionDescriptionInit }) => {
    const from = authSocket.userId;
    const chatId = Number(data.chatId);
    const to = Number(data.to);
    if (!from || !isGroupCallParticipant(chatId, from) || !isGroupCallParticipant(chatId, to)) return;
    const fromParticipant = groupCallRooms.get(chatId)?.participants.get(from);
    io.to(`user_${to}`).emit("group_call_offer", {
      chatId,
      from,
      username: fromParticipant?.username,
      signal: data.signal,
    });
  });

  socket.on("group_call_answer", (data: { chatId: number; to: number; signal: RTCSessionDescriptionInit }) => {
    const from = authSocket.userId;
    const chatId = Number(data.chatId);
    const to = Number(data.to);
    if (!from || !isGroupCallParticipant(chatId, from) || !isGroupCallParticipant(chatId, to)) return;
    io.to(`user_${to}`).emit("group_call_answer", { chatId, from, signal: data.signal });
  });

  socket.on("group_call_ice_candidate", (data: { chatId: number; to: number; candidate: RTCIceCandidateInit }) => {
    const from = authSocket.userId;
    const chatId = Number(data.chatId);
    const to = Number(data.to);
    if (!from || !isGroupCallParticipant(chatId, from) || !isGroupCallParticipant(chatId, to)) return;
    io.to(`user_${to}`).emit("group_call_ice_candidate", { chatId, from, candidate: data.candidate });
  });

  socket.on("group_call_media_state", (data: { chatId: number; audioMuted: boolean; videoMuted: boolean }) => {
    const userId = authSocket.userId;
    const chatId = Number(data.chatId);
    if (!userId || !isGroupCallParticipant(chatId, userId)) return;
    const participant = groupCallRooms.get(chatId)?.participants.get(userId);
    if (participant) {
      participant.audioMuted = Boolean(data.audioMuted);
      participant.videoMuted = Boolean(data.videoMuted);
    }
    socket.to(`call_${chatId}`).emit("group_call_media_state", {
      chatId,
      userId,
      audioMuted: Boolean(data.audioMuted),
      videoMuted: Boolean(data.videoMuted),
    });
  });

  socket.on("group_call_leave", (data: { chatId: number }) => {
    const userId = authSocket.userId;
    const chatId = Number(data.chatId);
    if (!userId || !Number.isFinite(chatId)) return;
    const removed = leaveGroupCallRoom(chatId, userId);
    socket.leave(`call_${chatId}`);
    if (!removed) return;

    if (getGroupCallParticipants(chatId).length > 0) {
      io.to(`call_${chatId}`).emit("group_call_participant_left", { chatId, userId });
    } else {
      io.to(`chat_${chatId}`).emit("group_call_ended", { chatId });
    }
  });

  // ─── Group Call (mediasoup SFU) ───────────────────────────────────────────

  socket.on("legacy_mediasoup_group_call_join", async (data: { chatId: number; username: string }, ack) => {
    const userId = authSocket.userId;
    if (!userId) return;
    try {
      // Verify user is in the chat
      const memberCheck = await client.query(
        "SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2",
        [data.chatId, userId]
      );
      if (memberCheck.rows.length === 0) {
        if (ack) ack({ error: "Нет доступа к чату" });
        return;
      }

      const isFirstParticipant = !mediasoupService.isRoomActive(data.chatId);

      await mediasoupService.joinRoom(data.chatId, userId, socket.id, data.username);
      socket.join(`call_${data.chatId}`);

      if (isFirstParticipant) {
        io.to(`chat_${data.chatId}`).emit("group_call_started", {
          chatId: data.chatId,
          startedBy: { userId, username: data.username },
        });
      } else {
        socket.to(`call_${data.chatId}`).emit("group_call_participant_joined", {
          chatId: data.chatId,
          userId,
          username: data.username,
        });
      }

      const participants = mediasoupService.getParticipants(data.chatId);
      if (ack) ack({ participants });
    } catch (e) {
      console.error("group_call_join error:", e);
      if (ack) ack({ error: "Ошибка входа в звонок" });
    }
  });

  socket.on("legacy_mediasoup_get_rtp_capabilities", (data: { chatId: number }, ack) => {
    const caps = mediasoupService.getRtpCapabilities(data.chatId);
    if (ack) ack({ rtpCapabilities: caps });
  });

  socket.on("legacy_mediasoup_create_transport", async (data: { chatId: number; direction: "send" | "recv" }, ack) => {
    const userId = authSocket.userId;
    if (!userId) return;
    try {
      const { params } = await mediasoupService.createWebRtcTransport(data.chatId, userId, data.direction);
      if (ack) ack({ params });
    } catch (e) {
      console.error("create_transport error:", e);
      if (ack) ack({ error: "Ошибка создания транспорта" });
    }
  });

  socket.on("legacy_mediasoup_connect_transport", async (data: { chatId: number; transportId: string; dtlsParameters: object }, ack) => {
    const userId = authSocket.userId;
    if (!userId) return;
    try {
      await mediasoupService.connectTransport(data.chatId, userId, data.transportId, data.dtlsParameters);
      if (ack) ack({ connected: true });
    } catch (e) {
      console.error("connect_transport error:", e);
      if (ack) ack({ error: "Ошибка подключения транспорта" });
    }
  });

  socket.on("legacy_mediasoup_produce", async (data: { chatId: number; kind: "audio" | "video"; rtpParameters: object }, ack) => {
    const userId = authSocket.userId;
    if (!userId) return;
    try {
      const producer = await mediasoupService.produce(data.chatId, userId, data.kind, data.rtpParameters);
      // Notify others in the call room about the new producer
      socket.to(`call_${data.chatId}`).emit("new_producer", {
        chatId: data.chatId,
        producerId: producer.id,
        userId,
      });
      if (ack) ack({ producerId: producer.id });
    } catch (e) {
      console.error("produce error:", e);
      if (ack) ack({ error: "Ошибка продюсирования" });
    }
  });

  socket.on("legacy_mediasoup_consume", async (data: { chatId: number; producerId: string; rtpCapabilities: object }, ack) => {
    const userId = authSocket.userId;
    if (!userId) return;
    try {
      const result = await mediasoupService.consume(data.chatId, userId, data.producerId, data.rtpCapabilities);
      if (!result) {
        if (ack) ack({ error: "Не удалось создать консьюмера" });
        return;
      }
      if (ack) ack({ params: result.params });
    } catch (e) {
      console.error("consume error:", e);
      if (ack) ack({ error: "Ошибка потребления" });
    }
  });

  socket.on("legacy_mediasoup_consumer_resume", async (data: { chatId: number; consumerId: string }) => {
    const userId = authSocket.userId;
    if (!userId) return;
    await mediasoupService.resumeConsumer(data.chatId, userId, data.consumerId).catch(console.error);
  });

  socket.on("legacy_mediasoup_group_call_leave", (data: { chatId: number }) => {
    const userId = authSocket.userId;
    if (!userId) return;
    const closedProducerIds = mediasoupService.leaveRoom(data.chatId, userId);
    socket.leave(`call_${data.chatId}`);

    if (mediasoupService.isRoomActive(data.chatId)) {
      io.to(`call_${data.chatId}`).emit("group_call_participant_left", {
        chatId: data.chatId,
        userId,
        closedProducerIds,
      });
    } else {
      io.to(`chat_${data.chatId}`).emit("group_call_ended", { chatId: data.chatId });
    }
  });

  // ─── End Group Call ───────────────────────────────────────────────────────

  // ─── Subtitle broadcast (text-based, kept for backwards compat) ──────────
  socket.on("subtitle_broadcast", (data: { to?: number; chatId?: number; text: string; speakerId: string; username: string; isFinal: boolean; lang?: string }) => {
    const userId = authSocket.userId;
    if (!userId) return;
    const payload = { text: data.text, speakerId: data.speakerId, username: data.username, isFinal: data.isFinal, lang: data.lang };
    if (data.to) {
      io.to(`user_${data.to}`).emit("subtitle_received", payload);
    } else if (data.chatId) {
      socket.to(`call_${data.chatId}`).emit("subtitle_received", payload);
    }
  });

  // ─── Server-side STT via Deepgram ──────────────────────────────────────────
  // Client sends raw PCM16 audio chunks; server transcribes via Deepgram
  // and broadcasts results as subtitle_received events.

  // Mutable routing state for this socket — updated via subtitle_session_update
  const subtitleRoute: { to?: number; chatId?: number; username: string; lang: string; speakerId: string } = {
    username: "User",
    lang: "en-US",
    speakerId: "",
  };

  const broadcastSubtitle = (text: string, isFinal: boolean) => {
    const payload = {
      text,
      speakerId: subtitleRoute.speakerId,
      username: subtitleRoute.username,
      isFinal,
      lang: subtitleRoute.lang,
    };
    if (subtitleRoute.to) {
      io.to(`user_${subtitleRoute.to}`).emit("subtitle_received", payload);
      socket.emit("subtitle_received", payload);
    } else if (subtitleRoute.chatId) {
      io.to(`call_${subtitleRoute.chatId}`).emit("subtitle_received", payload);
    } else {
      // Fallback: echo back to sender (they see their own speech)
      socket.emit("subtitle_received", payload);
    }
  };

  socket.on("subtitle_audio_start", (data: { lang: string; to?: number; chatId?: number; username?: string }) => {
    const userId = authSocket.userId;
    if (!userId) return;

    subtitleRoute.speakerId = String(userId);
    subtitleRoute.lang = data.lang || "en-US";
    subtitleRoute.username = data.username || "User";
    subtitleRoute.to = data.to;
    subtitleRoute.chatId = data.chatId;

    console.log(`[SUBTITLE] audio_start user=${userId} lang=${subtitleRoute.lang} to=${subtitleRoute.to} chatId=${subtitleRoute.chatId}`);

    deepgramService.startSession(userId, subtitleRoute.lang, broadcastSubtitle);
  });

  // Client calls this when routing info becomes available (e.g. callerData loads after stream starts)
  socket.on("subtitle_session_update", (data: { to?: number; chatId?: number; username?: string; lang?: string }) => {
    if (data.to !== undefined) subtitleRoute.to = data.to;
    if (data.chatId !== undefined) subtitleRoute.chatId = data.chatId;
    if (data.username) subtitleRoute.username = data.username;
    if (data.lang) subtitleRoute.lang = data.lang;
    console.log(`[SUBTITLE] session_update → to=${subtitleRoute.to} chatId=${subtitleRoute.chatId}`);
  });

  let chunkLogCount = 0;
  socket.on("subtitle_audio_chunk", (audioData: ArrayBuffer | Buffer) => {
    const userId = authSocket.userId;
    if (!userId) return;
    const buf = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);
    if (chunkLogCount++ < 3) {
      console.log(`[SUBTITLE] audio_chunk user=${userId} size=${buf.length}B`);
    }
    deepgramService.sendAudio(userId, buf);
  });

  socket.on("subtitle_audio_stop", () => {
    const userId = authSocket.userId;
    if (!userId) return;
    deepgramService.stopSession(userId);
  });

  // ─── Mentions seen ────────────────────────────────────────────────────────
  socket.on("mentions_seen", async (data: { chatId: number }) => {
    const userId = authSocket.userId;
    if (!userId) return;
    await client.query(
      `UPDATE message_mentions mm SET seen = true
       FROM messages m WHERE mm.message_id = m.id
         AND mm.mentioned_user_id = $1 AND m.chat_id = $2`,
      [userId, data.chatId]
    ).catch(console.error);
  });

  // ─── Poll vote ────────────────────────────────────────────────────────────
  socket.on("poll_vote", async (data: { pollId: number; optionIndex: number }, ack) => {
    const userId = authSocket.userId;
    if (!userId) return;
    try {
      const pollRes = await client.query(
        "SELECT id, chat_id, closed FROM polls WHERE id = $1",
        [data.pollId]
      );
      if (pollRes.rows.length === 0) { if (ack) ack({ error: "Poll not found" }); return; }
      const poll = pollRes.rows[0];
      if (poll.closed) { if (ack) ack({ error: "Poll is closed" }); return; }

      const optRes = await client.query(
        "SELECT 1 FROM poll_options WHERE poll_id = $1 AND option_index = $2",
        [data.pollId, data.optionIndex]
      );
      if (optRes.rows.length === 0) { if (ack) ack({ error: "Invalid option" }); return; }

      // ON CONFLICT makes this atomic — single choice per user
      await client.query(
        `INSERT INTO poll_votes (poll_id, user_id, option_index, voted_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (poll_id, user_id) DO UPDATE SET option_index = EXCLUDED.option_index, voted_at = NOW()`,
        [data.pollId, userId, data.optionIndex]
      );

      // Отправляем только счётчики, не массив user_ids — защита от роста пакета
      const voteCountRes = await client.query<{ option_index: number; count: string }>(
        "SELECT option_index, COUNT(user_id)::text AS count FROM poll_votes WHERE poll_id = $1 GROUP BY option_index",
        [data.pollId]
      );
      // Собственный голос текущего пользователя
      const myVoteRes = await client.query<{ option_index: number }>(
        "SELECT option_index FROM poll_votes WHERE poll_id = $1 AND user_id = $2",
        [data.pollId, userId]
      );
      const votes: Record<string, number> = {};
      for (const row of voteCountRes.rows) {
        votes[String(row.option_index)] = Number(row.count);
      }
      const myVote = myVoteRes.rows[0]?.option_index ?? null;

      io.to(`chat_${poll.chat_id}`).emit("poll_updated", { pollId: data.pollId, votes, myVote });
      if (ack) ack({ ok: true, votes });
    } catch (e) {
      console.error("poll_vote error:", e);
      if (ack) ack({ error: "Vote failed" });
    }
  });

  // ─── Message read receipt ─────────────────────────────────────────────────
  socket.on("message_read", async (data: { messageId: number; chatId: number }) => {
    const userId = authSocket.userId;
    if (!userId) return;
    try {
      await client.query(
        "INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [data.messageId, userId]
      );
      socket.to(`chat_${data.chatId}`).emit("message_read_ack", { messageId: data.messageId, userId });
    } catch (e: unknown) {
      console.error("[message_read] error:", (e as Error).message);
    }
  });

  // Typing indicators
  socket.on("typing", (data: { chatId: number }) => {
    const userId = authSocket.userId;
    socket.to(`chat_${data.chatId}`).emit("user_typing", { chatId: data.chatId, userId });
  });

  socket.on("stop_typing", (data: { chatId: number }) => {
    const userId = authSocket.userId;
    socket.to(`chat_${data.chatId}`).emit("user_stop_typing", { chatId: data.chatId, userId });
  });

  socket.on("disconnect", async () => {
    console.log("Socket disconnected:", socket.id);
    const userId = authSocket.userId;
    if (userId) {
      // Clean up Deepgram STT session on disconnect
      deepgramService.stopSession(userId);

      // Clean up 1-on-1 call busy state on disconnect
      if (usersInCall.has(userId)) {
        const otherId = usersInCall.get(userId);
        if (otherId !== undefined) {
          clearP2PCall(userId, otherId);
          io.to(`user_${otherId}`).emit("call_ended");
        } else {
          clearP2PCall(userId);
        }
      }

      for (const chatId of leaveAllGroupCallRooms(userId)) {
        if (getGroupCallParticipants(chatId).length > 0) {
          io.to(`call_${chatId}`).emit("group_call_participant_left", { chatId, userId });
        } else {
          io.to(`chat_${chatId}`).emit("group_call_ended", { chatId });
        }
      }
      try {
        // Check if user is in invisible mode — if so, they're already showing as offline
        const invisRes = await client.query("SELECT is_invisible FROM users WHERE id = $1", [userId]);
        const isInvisible = invisRes.rows[0]?.is_invisible === true;

        if (!isInvisible) {
          await client.query("UPDATE users SET status = 'offline', last_seen = NOW() WHERE id = $1", [userId]);
        }
        const userRooms = await client.query(
          "SELECT chat_id FROM chat_users WHERE user_id = $1",
          [userId]
        );
        if (!isInvisible) {
          for (const row of userRooms.rows) {
            io.to(`chat_${row.chat_id}`).emit("user_status_changed", { userId, status: "offline" });
          }
          // Also notify friends
          const friendsOffRes = await client.query(
            "SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS friend_id FROM friends WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'",
            [userId]
          );
          for (const row of friendsOffRes.rows) {
            io.to(`user_${row.friend_id}`).emit("user_status_changed", { userId, status: "offline" });
          }
        }
        for (const row of userRooms.rows) {

          // Clean up group call participation if disconnected mid-call
          if (mediasoupService.isRoomActive(row.chat_id)) {
            const closedProducerIds = mediasoupService.leaveRoom(row.chat_id, userId);
            if (closedProducerIds.length > 0) {
              if (mediasoupService.isRoomActive(row.chat_id)) {
                io.to(`call_${row.chat_id}`).emit("group_call_participant_left", {
                  chatId: row.chat_id,
                  userId,
                  closedProducerIds,
                });
              } else {
                io.to(`chat_${row.chat_id}`).emit("group_call_ended", { chatId: row.chat_id });
              }
            }
          }
        }
      } catch (e) {
        console.error("Error updating offline status:", e);
      }
    }
  });
});

app.use(express.json());
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});
app.use("/stickers", express.static(require("path").join(process.cwd(), "public/stickers")));
app.use("/auth", authRouter);
app.use("/chats", chatRouter);
app.use("/friends", friendsRouter);
app.use("/users", usersRouter);
app.use("/admin", adminRouter);
app.use("/moderator", moderatorRouter);
app.get("/api/livekit-token", authMiddleware, async (req: Request, res: Response) => {
  try {
    const chatId = Number(req.query.chatId);
    if (!Number.isFinite(chatId)) {
      return res.status(400).json({ error: "Invalid chatId" });
    }

    const user = (req as Request & { user?: { id: number; username?: string } }).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const livekitUrl = process.env.LIVEKIT_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return res.status(501).json({ enabled: false, error: "LiveKit is not configured" });
    }

    const memberCheck = await client.query(
      "SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2",
      [chatId, user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: "No access to chat" });
    }

    const userRes = await client.query<{ username: string }>(
      "SELECT username FROM users WHERE id = $1",
      [user.id]
    );
    const username = userRes.rows[0]?.username || user.username || `User ${user.id}`;
    const roomName = `lume-chat-${chatId}`;
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: String(user.id),
      name: username,
      ttl: "2h",
      metadata: JSON.stringify({ chatId, username }),
    });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return res.json({
      enabled: true,
      url: livekitUrl,
      token: await token.toJwt(),
      roomName,
    });
  } catch (e) {
    console.error("[LIVEKIT] token error:", e);
    return res.status(500).json({ error: "Failed to create LiveKit token" });
  }
});
// ─── TURN credentials endpoint ─────────────────────────────────────────────
// Fetches temporary TURN credentials from Metered.ca REST API.
// Cached for 1 hour to avoid hitting Metered API on every call.
// Set METERED_API_KEY env var on Render dashboard.
interface IceServer { urls: string | string[]; username?: string; credential?: string; credentialType?: string; }
let turnCache: { servers: IceServer[]; expiresAt: number } | null = null;
const TURN_CACHE_TTL = 60 * 60 * 1000; // 1 hour (credentials valid ~24h)

const STUN_FALLBACK = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

app.get("/api/turn-credentials", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.METERED_API_KEY;
    if (!apiKey) {
      return res.json(STUN_FALLBACK);
    }

    // Return cached credentials if still valid
    if (turnCache && Date.now() < turnCache.expiresAt) {
      return res.json(turnCache.servers);
    }

    const meteredApp = process.env.METERED_APP_NAME || "antmag";
    if (!/^[a-z0-9-]+$/i.test(meteredApp)) {
      console.error("[TURN] Invalid METERED_APP_NAME — contains unsafe characters");
      return res.json(STUN_FALLBACK);
    }
    const response = await fetch(
      `https://${meteredApp}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );

    if (!response.ok) {
      console.error("[TURN] Metered API error:", response.status, await response.text());
      return res.json(turnCache?.servers ?? STUN_FALLBACK);
    }

    const iceServers = await response.json() as IceServer[];
    turnCache = { servers: iceServers, expiresAt: Date.now() + TURN_CACHE_TTL };
    console.log("[TURN] Got", iceServers.length, "ICE servers from Metered (cached for 1h)");
    return res.json(iceServers);
  } catch (e) {
    console.error("[TURN] Error fetching credentials:", e);
    return res.json(turnCache?.servers ?? STUN_FALLBACK);
  }
});

// ─── DeepL Translation endpoint ───────────────────────────────────────────
app.post("/api/translate", async (req: Request, res: Response) => {
  try {
    const { text, from, to } = req.body as { text?: string; from?: string; to?: string };
    if (!text || !from || !to) {
      return res.status(400).json({ error: "Missing text, from, or to" });
    }
    const translated = await deeplTranslate(text, from, to);
    return res.json({ translated });
  } catch (e: unknown) {
    console.error("[TRANSLATE] Error:", e);
    return res.status(500).json({ error: "Translation failed", translated: req.body?.text || "" });
  }
});

app.use((err: { status?: number; message?: string }, req: Request, res: Response, _next: NextFunction) => {
  logger.error(
    `EXPRESS ERROR: ${req.method} ${req.originalUrl} - ${err.message}`,
    err
  );

  res
    .status(err.status || 500)
    .json({ message: err.message || "Server Error" });
});

async function initializeDatabase() {
  try {
    console.log("🔄 Initializing Database...");

    await client.query(
      `CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, value VARCHAR(50) UNIQUE NOT NULL DEFAULT 'USER');`
    );
    await client.query(
      `INSERT INTO roles (value) VALUES ('USER'), ('ADMIN'), ('MODERATOR') ON CONFLICT (value) DO NOTHING;`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL, avatar_url TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`
    );
    
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;`);
    } catch (e: any) { if (e.code !== "42701") throw e; }
    
    try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;`);
    } catch (e: any) { if (e.code !== "42701") throw e; }

    await client.query(
      `CREATE TABLE IF NOT EXISTS chats (id SERIAL PRIMARY KEY, name VARCHAR(50), is_group BOOLEAN DEFAULT false, creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL, invite_code VARCHAR(16) UNIQUE);`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_chats_invite_code ON chats(invite_code);`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS chat_users (id SERIAL PRIMARY KEY, chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL);`
    );

    try {
      await client.query(`ALTER TABLE chat_users ADD COLUMN IF NOT EXISTS chat_role VARCHAR(20) NOT NULL DEFAULT 'member';`);
    } catch (e: any) { if (e.code !== "42701") throw e; }
    // Enforce valid chat role values — prevents arbitrary strings
    await client.query(
      `DO $$ BEGIN
         ALTER TABLE chat_users ADD CONSTRAINT chat_users_chat_role_check
           CHECK (chat_role IN ('member', 'moderator', 'trusted'));
       EXCEPTION WHEN duplicate_object THEN NULL;
       END $$;`
    );

    await client.query(
      `CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE, sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`
    );
    // Per-user soft-delete: 1NF-compliant replacement for deleted_for INTEGER[]
    await client.query(
      `CREATE TABLE IF NOT EXISTS message_deleted_for (
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        PRIMARY KEY (message_id, user_id)
      );`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS friends (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(user_id, friend_id));`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS registration_codes (email VARCHAR(255) PRIMARY KEY NOT NULL, username VARCHAR(50) NOT NULL, password TEXT NOT NULL, avatar_url TEXT, code VARCHAR(6) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`
    );

    await client.query(
      `CREATE TABLE IF NOT EXISTS warnings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`
    );

    await client.query(
      `CREATE TABLE IF NOT EXISTS reports (
        id               SERIAL  PRIMARY KEY,
        reporter_id      INTEGER REFERENCES users(id)    ON DELETE CASCADE,
        reported_user_id INTEGER REFERENCES users(id)    ON DELETE CASCADE,
        message_id       INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        reason           TEXT    NOT NULL,
        status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'resolved', 'dismissed')),
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`
    );
    // Migrate existing reports table — add reported_user_id if missing
    try { await client.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`); } catch(e: any) { if (e.code !== "42701") throw e; }
    await client.query(
      `CREATE TABLE IF NOT EXISTS app_logs (
        id         SERIAL  PRIMARY KEY,
        level      VARCHAR(20) NOT NULL,
        message    TEXT NOT NULL,
        meta       JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_logs_level      ON app_logs(level);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at DESC);`);

    try {
      await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;`);
    } catch (e: any) { if (e.code !== "42701") throw e; }

    await client.query(
      `CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        UNIQUE(message_id, user_id, emoji)
      );`
    );

    // Message editing
    try {
      await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;`);
    } catch (e: any) { if (e.code !== "42701") throw e; }

    // Forwarded messages
    try {
      await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;`);
    } catch (e: any) { if (e.code !== "42701") throw e; }

    // Pinned messages
    await client.query(
      `CREATE TABLE IF NOT EXISTS pinned_messages (
        id SERIAL PRIMARY KEY,
        chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        pinned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        pinned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chat_id, message_id)
      );`
    );

    // Read status tracking
    await client.query(
      `CREATE TABLE IF NOT EXISTS chat_read_status (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
        last_read_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        last_read_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, chat_id)
      );`
    );

    // User status and theme
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'offline';`);
    } catch (e: any) { if (e.code !== "42701") throw e; }

    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'dark';`);
    } catch (e: any) { if (e.code !== "42701") throw e; }

    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_invisible BOOLEAN DEFAULT false;`);
    } catch (e: any) { if (e.code !== "42701") throw e; }

    // Cosmetic / personalization columns on users
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_frame VARCHAR(50) DEFAULT NULL;`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(4) DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_bg TEXT DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username_color VARCHAR(20) DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username_anim VARCHAR(30) DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_badge VARCHAR(10) DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bubble_color VARCHAR(20) DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS social_link TEXT DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }

    // last_seen
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();`); } catch(e: any) { if (e.code !== "42701") throw e; }

    // Message extra features: expires_at for ephemeral, is_silent for notifications
    try { await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;`); } catch(e: any) { if (e.code !== "42701") throw e; }

    // Scheduled messages
    await client.query(
      `CREATE TABLE IF NOT EXISTS scheduled_messages (
        id SERIAL PRIMARY KEY,
        chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        send_at TIMESTAMPTZ NOT NULL,
        sent BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`
    );

    // Polls — normalized: options and votes are separate tables (1NF)
    await client.query(
      `CREATE TABLE IF NOT EXISTS polls (
        id         SERIAL PRIMARY KEY,
        chat_id    INTEGER REFERENCES chats(id)    ON DELETE CASCADE,
        creator_id INTEGER REFERENCES users(id)    ON DELETE CASCADE,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        question   TEXT    NOT NULL,
        closed     BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`
    );
    // Each poll option row (atomic — replaces options JSONB array)
    await client.query(
      `CREATE TABLE IF NOT EXISTS poll_options (
        id           SERIAL  PRIMARY KEY,
        poll_id      INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        option_index SMALLINT NOT NULL,
        option_text  TEXT    NOT NULL,
        UNIQUE (poll_id, option_index)
      );`
    );
    // Each vote row — one row per user per poll (replaces votes JSONB, prevents race conditions)
    await client.query(
      `CREATE TABLE IF NOT EXISTS poll_votes (
        poll_id      INTEGER NOT NULL REFERENCES polls(id)        ON DELETE CASCADE,
        user_id      INTEGER NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
        option_index SMALLINT NOT NULL,
        voted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (poll_id, user_id)
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_poll_options_poll      ON poll_options(poll_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_poll_votes_poll        ON poll_votes(poll_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_polls_chat             ON polls(chat_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_send_at_sent ON scheduled_messages(send_at, sent) WHERE sent = false;`);

    // Mentions — chat_id removed (3NF: derivable via message_id → messages.chat_id)
    await client.query(
      `CREATE TABLE IF NOT EXISTS message_mentions (
        id                SERIAL  PRIMARY KEY,
        message_id        INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        mentioned_user_id INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        seen              BOOLEAN NOT NULL DEFAULT false,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (message_id, mentioned_user_id)
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mentions_user ON message_mentions(mentioned_user_id);`);

    // Read receipts per message
    await client.query(
      `CREATE TABLE IF NOT EXISTS message_reads (
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (message_id, user_id)
      );`
    );

    // Password reset codes
    await client.query(
      `CREATE TABLE IF NOT EXISTS password_reset_codes (
        email VARCHAR(255) PRIMARY KEY NOT NULL,
        code VARCHAR(6) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`
    );

    // ─── Performance indexes ──────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id         ON messages(chat_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender_id       ON messages(sender_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(chat_id, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_users_user_id       ON chat_users(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_users_chat_id       ON chat_users(chat_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_friends_user_id          ON friends(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_friends_friend_id        ON friends(friend_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_reactions_msg    ON message_reactions(message_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_reads_msg        ON message_reads(message_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_deleted_for_user ON message_deleted_for(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_status           ON reports(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_reported_user    ON reports(reported_user_id);`);

    const bootstrapAdminUsername = process.env.ADMIN_USERNAME;
    const bootstrapAdminPassword = process.env.ADMIN_PASSWORD;
    if (bootstrapAdminUsername && bootstrapAdminPassword) {
      const defaultAdminPassword = await bcrypt.hash(bootstrapAdminPassword, 10);
      await client.query(
      `INSERT INTO users (username, password, role_id, email, avatar_url, is_banned)
       VALUES ($1, $2, (SELECT id FROM roles WHERE value = 'ADMIN'), NULL, NULL, false)
       ON CONFLICT (username) DO UPDATE
       SET password = EXCLUDED.password,
           role_id = (SELECT id FROM roles WHERE value = 'ADMIN'),
           is_banned = false`,
      [bootstrapAdminUsername, defaultAdminPassword]
      );
      console.log(`Admin bootstrap user is ready: ${bootstrapAdminUsername}`);
    } else if (process.env.NODE_ENV !== "production") {
      const localAdminPassword = await bcrypt.hash("admin", 10);
      await client.query(
        `INSERT INTO users (username, password, role_id, email, avatar_url, is_banned)
         VALUES ($1, $2, (SELECT id FROM roles WHERE value = 'ADMIN'), NULL, NULL, false)
         ON CONFLICT (username) DO NOTHING`,
        ["admin", localAdminPassword]
      );
      console.log("Local admin bootstrap is available only outside production.");
    }

    const sysUser = await client.query("SELECT id FROM users WHERE username = 'LumeOfficial'");
    if (sysUser.rows.length === 0) {
      const systemPwd = process.env.SYSTEM_USER_PASSWORD;
      if (!systemPwd) {
        console.warn("SYSTEM_USER_PASSWORD is not set; skipping LumeOfficial bootstrap user.");
      } else {
      const hashedPassword = await bcrypt.hash(systemPwd, 10);
      await client.query(
        `INSERT INTO users (username, password, role_id, email, avatar_url) 
         VALUES ($1, $2, (SELECT id FROM roles WHERE value = 'ADMIN'), $3, NULL)`,
        ["LumeOfficial", hashedPassword, "system@lume.app"]
      );
      console.log("✅ System user 'LumeOfficial' created.");
    }

    }

    if (AUTO_MODERATOR_NAME) {
      const roleRes = await client.query("SELECT id FROM roles WHERE value = 'MODERATOR'");
      if (roleRes.rows.length > 0) {
        const modRoleId = roleRes.rows[0].id;
        
        const updateRes = await client.query(
          `UPDATE users 
           SET role_id = $1 
           WHERE username = $2 AND role_id != $1 AND role_id != (SELECT id FROM roles WHERE value='ADMIN')
           RETURNING id`,
          [modRoleId, AUTO_MODERATOR_NAME]
        );
        
        if (updateRes.rowCount && updateRes.rowCount > 0) {
          console.log(`🎉 User '${AUTO_MODERATOR_NAME}' is now a MODERATOR!`);
        }
      }
    }

    console.log("✅ DB initialized successfully.");
  } catch (e) {
    console.error("❌ DB Init Error:", e);
    // Не убиваем процесс, чтобы дать шанс перезапуститься или разобраться
    // process.exit(1); 
  }
}

async function start() {
  await initializeDatabase();
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

  // ─── Scheduled messages: check every 30 seconds ────────────────────────
  setInterval(async () => {
    try {
      const res = await client.query(
        `SELECT sm.*, u.username as sender_name, u.avatar_url as sender_avatar, u.is_banned
         FROM scheduled_messages sm
         JOIN users u ON u.id = sm.sender_id
         WHERE sm.send_at <= NOW() AND sm.sent = false`
      );
      for (const row of res.rows) {
        // Skip if sender was banned since the message was scheduled
        if (row.is_banned) {
          await client.query("UPDATE scheduled_messages SET sent = true WHERE id = $1", [row.id]);
          console.log(`[SCHEDULED] Skipped msg ${row.id} — sender ${row.sender_id} is banned`);
          continue;
        }

        // Skip if sender is no longer a member of the chat
        const memberCheck = await client.query(
          "SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2",
          [row.chat_id, row.sender_id]
        );
        if (memberCheck.rows.length === 0) {
          await client.query("UPDATE scheduled_messages SET sent = true WHERE id = $1", [row.id]);
          console.log(`[SCHEDULED] Skipped msg ${row.id} — sender ${row.sender_id} no longer in chat ${row.chat_id}`);
          continue;
        }

        const msgRes = await client.query(
          `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) RETURNING id, created_at`,
          [row.chat_id, row.sender_id, row.text]
        );
        const msg = msgRes.rows[0];
        await client.query("UPDATE scheduled_messages SET sent = true WHERE id = $1", [row.id]);
        io.to(`chat_${row.chat_id}`).emit("new_message", {
          id: msg.id,
          chat_id: row.chat_id,
          sender_id: row.sender_id,
          sender_name: row.sender_name,
          sender_avatar: row.sender_avatar,
          text: row.text,
          created_at: msg.created_at,
          reactions: [],
        });
      }
    } catch (e) {
      console.error("[SCHEDULED] Error:", e);
    }
  }, 30_000);

  // ─── Ephemeral messages: delete expired every minute ───────────────────
  setInterval(async () => {
    try {
      const res = await client.query(
        `DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= NOW() RETURNING id, chat_id`
      );
      for (const row of res.rows) {
        io.to(`chat_${row.chat_id}`).emit("message_deleted", { messageId: row.id, chatId: row.chat_id });
      }
    } catch (e) {
      console.error("[EPHEMERAL] Cleanup error:", e);
    }
  }, 60_000);

  // ─── TTL cleanup: purge expired auth codes every 10 minutes ────────────
  setInterval(async () => {
    try {
      await client.query(`DELETE FROM registration_codes  WHERE created_at < NOW() - INTERVAL '1 hour'`);
      await client.query(`DELETE FROM password_reset_codes WHERE created_at < NOW() - INTERVAL '15 minutes'`);
    } catch (e) {
      console.error("[TTL] Auth code cleanup error:", e);
    }
  }, 10 * 60_000);
}

const intervals: ReturnType<typeof setInterval>[] = [];

const originalSetInterval = setInterval;
(global as unknown as Record<string, unknown>).setInterval = ((...args: Parameters<typeof setInterval>) => {
  const id = originalSetInterval(...args);
  intervals.push(id);
  return id;
}) as typeof setInterval;

async function gracefulShutdown(signal: string) {
  console.log(`\n[SHUTDOWN] Received ${signal}, shutting down gracefully...`);
  intervals.forEach(clearInterval);
  server.close(() => {
    console.log("[SHUTDOWN] HTTP server closed.");
    client.end().then(() => {
      console.log("[SHUTDOWN] DB connection pool closed.");
      process.exit(0);
    }).catch(() => process.exit(1));
  });
  setTimeout(() => {
    console.error("[SHUTDOWN] Forced exit after 10s timeout.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

start();
