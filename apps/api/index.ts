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

import authRouter from "./Routes/authRouter";
import chatRouter from "./Routes/chatRouter";
import usersRouter from "./Routes/usersRouter";
import friendsRouter from "./Routes/friendsRouter";
import adminRouter from "./Routes/adminRouter";
import moderatorRouter from "./Routes/moderatorRouter";
import logger from "./Services/logService";
import * as mediasoupService from "./Services/mediasoupService";
import * as deepgramService from "./Services/deepgramService";
import { translateText as deeplTranslate } from "./Services/deeplService";

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
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,  // Primary production frontend URL
  process.env.CLIENT_URL,    // Alias used in docker-compose
].filter(Boolean) as string[];

app.use(
  cors({
    origin: function (origin, callback) {
      // Разрешаем запросы без origin (например, мобильные приложения или curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`CORS blocked: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) return next(new Error("Authentication error: no token"));

    const decoded = jwt.verify(token, secret) as any;
    
    const userRes = await client.query("SELECT is_banned FROM users WHERE id = $1", [decoded.id]);
    if (userRes.rows.length > 0 && userRes.rows[0].is_banned) {
       console.log(`Rejected socket connection from banned user: ${decoded.id}`);
       return next(new Error("User is banned"));
    }

    (socket as any).userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

// Track users currently in a 1-on-1 call (userId → otherUserId)
const usersInCall = new Map<number, number>();

io.on("connection", async (socket: Socket) => {
  console.log("Socket connected:", socket.id);
  const connectedUserId = (socket as any).userId;
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

  // Keep for backwards compatibility but server already auto-joined
  socket.on("join_user_room", (userId: string | number) => {
    socket.join(`user_${userId}`);
  });

  socket.on("join_chat", (chatId: string | number) => {
    socket.join(`chat_${chatId}`);
  });

  socket.on("leave_chat", (chatId: string | number) => {
    socket.leave(`chat_${chatId}`);
  });

  socket.on("call_user", (data: { userToCall: number; signalData: any; from: number; name: string; isVideo: boolean }) => {
    const callerUserId = (socket as any).userId;
    const targetId = Number(data.userToCall);
    const fromId = Number(data.from);
    console.log(`[CALL] call_user: from=${fromId} (socket userId=${callerUserId}) → to=${targetId}`);

    // If target is already in a call, notify caller that they're busy
    if (usersInCall.has(targetId)) {
      console.log(`[CALL] User ${targetId} is busy, usersInCall:`, [...usersInCall.entries()]);
      socket.emit("call_busy", { userId: targetId });
      return;
    }
    // Mark both users as in a call
    usersInCall.set(fromId, targetId);
    usersInCall.set(targetId, fromId);

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

  socket.on("answer_call", (data: { to: number; signal: any }) => {
    io.to(`user_${data.to}`).emit("call_accepted", data.signal);
  });

  socket.on("send_ice_candidate", (data: { to: number; candidate: any }) => {
    io.to(`user_${data.to}`).emit("receive_ice_candidate", { candidate: data.candidate });
  });

  socket.on("end_call", (data: { to: number }) => {
    const userId = (socket as any).userId;
    // Clean up busy tracking
    if (userId) usersInCall.delete(userId);
    usersInCall.delete(data.to);
    io.to(`user_${data.to}`).emit("call_ended");
  });

  socket.on("call_declined", (data: { to: number }) => {
    const userId = (socket as any).userId;
    // Clean up busy tracking
    if (userId) usersInCall.delete(userId);
    usersInCall.delete(data.to);
    // Notify caller that the call was declined (missed call)
    io.to(`user_${data.to}`).emit("call_missed", { from: userId });
  });

  // ─── Group Call (mediasoup SFU) ───────────────────────────────────────────

  socket.on("group_call_join", async (data: { chatId: number; username: string }, ack) => {
    const userId = (socket as any).userId;
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

  socket.on("get_rtp_capabilities", (data: { chatId: number }, ack) => {
    const caps = mediasoupService.getRtpCapabilities(data.chatId);
    if (ack) ack({ rtpCapabilities: caps });
  });

  socket.on("create_transport", async (data: { chatId: number; direction: "send" | "recv" }, ack) => {
    const userId = (socket as any).userId;
    if (!userId) return;
    try {
      const { params } = await mediasoupService.createWebRtcTransport(data.chatId, userId, data.direction);
      if (ack) ack({ params });
    } catch (e) {
      console.error("create_transport error:", e);
      if (ack) ack({ error: "Ошибка создания транспорта" });
    }
  });

  socket.on("connect_transport", async (data: { chatId: number; transportId: string; dtlsParameters: object }, ack) => {
    const userId = (socket as any).userId;
    if (!userId) return;
    try {
      await mediasoupService.connectTransport(data.chatId, userId, data.transportId, data.dtlsParameters);
      if (ack) ack({ connected: true });
    } catch (e) {
      console.error("connect_transport error:", e);
      if (ack) ack({ error: "Ошибка подключения транспорта" });
    }
  });

  socket.on("produce", async (data: { chatId: number; kind: "audio" | "video"; rtpParameters: object }, ack) => {
    const userId = (socket as any).userId;
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

  socket.on("consume", async (data: { chatId: number; producerId: string; rtpCapabilities: object }, ack) => {
    const userId = (socket as any).userId;
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

  socket.on("consumer_resume", async (data: { chatId: number; consumerId: string }) => {
    const userId = (socket as any).userId;
    if (!userId) return;
    await mediasoupService.resumeConsumer(data.chatId, userId, data.consumerId).catch(console.error);
  });

  socket.on("group_call_leave", (data: { chatId: number }) => {
    const userId = (socket as any).userId;
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
    const userId = (socket as any).userId;
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
    const userId = (socket as any).userId;
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
    const userId = (socket as any).userId;
    if (!userId) return;
    const buf = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);
    if (chunkLogCount++ < 3) {
      console.log(`[SUBTITLE] audio_chunk user=${userId} size=${buf.length}B`);
    }
    deepgramService.sendAudio(userId, buf);
  });

  socket.on("subtitle_audio_stop", () => {
    const userId = (socket as any).userId;
    if (!userId) return;
    deepgramService.stopSession(userId);
  });

  // Typing indicators
  socket.on("typing", (data: { chatId: number }) => {
    const userId = (socket as any).userId;
    socket.to(`chat_${data.chatId}`).emit("user_typing", { chatId: data.chatId, userId });
  });

  socket.on("stop_typing", (data: { chatId: number }) => {
    const userId = (socket as any).userId;
    socket.to(`chat_${data.chatId}`).emit("user_stop_typing", { chatId: data.chatId, userId });
  });

  socket.on("disconnect", async () => {
    console.log("Socket disconnected:", socket.id);
    const userId = (socket as any).userId;
    if (userId) {
      // Clean up Deepgram STT session on disconnect
      deepgramService.stopSession(userId);

      // Clean up 1-on-1 call busy state on disconnect
      if (usersInCall.has(userId)) {
        const otherId = usersInCall.get(userId);
        usersInCall.delete(userId);
        if (otherId !== undefined) {
          usersInCall.delete(otherId);
          io.to(`user_${otherId}`).emit("call_ended");
        }
      }
      try {
        // Check if user is in invisible mode — if so, they're already showing as offline
        const invisRes = await client.query("SELECT is_invisible FROM users WHERE id = $1", [userId]);
        const isInvisible = invisRes.rows[0]?.is_invisible === true;

        if (!isInvisible) {
          await client.query("UPDATE users SET status = 'offline' WHERE id = $1", [userId]);
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
app.use("/stickers", express.static(require("path").join(process.cwd(), "public/stickers")));
app.use("/auth", authRouter);
app.use("/chats", chatRouter);
app.use("/friends", friendsRouter);
app.use("/users", usersRouter);
app.use("/admin", adminRouter);
app.use("/moderator", moderatorRouter);
// ─── TURN credentials endpoint ─────────────────────────────────────────────
// Fetches temporary TURN credentials from Metered.ca REST API.
// Cached for 1 hour to avoid hitting Metered API on every call.
// Set METERED_API_KEY env var on Render dashboard.
let turnCache: { servers: any[]; expiresAt: number } | null = null;
const TURN_CACHE_TTL = 60 * 60 * 1000; // 1 hour (credentials valid ~24h)

const STUN_FALLBACK = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

app.get("/api/turn-credentials", async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.METERED_API_KEY;
    if (!apiKey) {
      return res.json(STUN_FALLBACK);
    }

    // Return cached credentials if still valid
    if (turnCache && Date.now() < turnCache.expiresAt) {
      return res.json(turnCache.servers);
    }

    const response = await fetch(
      `https://${process.env.METERED_APP_NAME || "antmag"}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );

    if (!response.ok) {
      console.error("[TURN] Metered API error:", response.status, await response.text());
      return res.json(turnCache?.servers ?? STUN_FALLBACK);
    }

    const iceServers = await response.json() as any[];
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
  } catch (e: any) {
    console.error("[TRANSLATE] Error:", e);
    return res.status(500).json({ error: "Translation failed", translated: req.body?.text || "" });
  }
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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

    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_frame VARCHAR(50) DEFAULT NULL;`);
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

    await client.query(
      `CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE, sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, deleted_for INTEGER[] DEFAULT '{}'::integer[]);`
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
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending', 
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS app_logs (
        id SERIAL PRIMARY KEY,
        level VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        meta TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`
    );

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

    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';`);
    } catch (e: any) { if (e.code !== "42701") throw e; }

    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(4) DEFAULT '';`);
    } catch (e: any) { if (e.code !== "42701") throw e; }

    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_bg TEXT DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username_color VARCHAR(20) DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }
    try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username_anim VARCHAR(30) DEFAULT '';`); } catch(e: any) { if (e.code !== "42701") throw e; }

    // Password reset codes
    await client.query(
      `CREATE TABLE IF NOT EXISTS password_reset_codes (
        email VARCHAR(255) PRIMARY KEY NOT NULL,
        code VARCHAR(6) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`
    );

    const sysUser = await client.query("SELECT id FROM users WHERE username = 'LumeOfficial'");
    if (sysUser.rows.length === 0) {
      const hashedPassword = await bcrypt.hash("super_secure_system_password_ChangeMe!", 10);
      await client.query(
        `INSERT INTO users (username, password, role_id, email, avatar_url) 
         VALUES ($1, $2, (SELECT id FROM roles WHERE value = 'ADMIN'), $3, NULL)`,
        ["LumeOfficial", hashedPassword, "system@lume.app"]
      );
      console.log("✅ System user 'LumeOfficial' created.");
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
  await mediasoupService.createWorker();
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

start();