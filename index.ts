import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import http from "http";
import { Server, Socket } from "socket.io";
import client from "./databasepg"; 
import bcrypt from "bcryptjs"; 

import authRouter from "./Routes/authRouter";
import chatRouter from "./Routes/chatRouter";
import usersRouter from "./Routes/usersRouter";
import friendsRouter from "./Routes/friendsRouter";
import adminRouter from "./Routes/adminRouter";
import logger from "./Services/logService";

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

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL || "", 
  "https://nodekursproj.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`CORS blocked origin: ${origin}`);
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

io.on("connection", (socket: Socket) => {
  console.log("Socket connected:", socket.id);

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
    io.to(`user_${data.userToCall}`).emit("incoming_call", { 
      signal: data.signalData, 
      from: data.from, 
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
    io.to(`user_${data.to}`).emit("call_ended");
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

app.use(express.json());
app.use("/auth", authRouter);
app.use("/chats", chatRouter);
app.use("/friends", friendsRouter);
app.use("/users", usersRouter);
app.use("/admin", adminRouter);

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
    await client.query(
      `CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, value VARCHAR(50) UNIQUE NOT NULL DEFAULT 'USER');`
    );
    await client.query(
      `INSERT INTO roles (value) VALUES ('USER'), ('ADMIN') ON CONFLICT (value) DO NOTHING;`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL, avatar_url TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`
    );
    try {
      await client.query(
        `ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;`
      );
    } catch (e: any) {
      if (e.code !== "42701") throw e;
    }
    await client.query(
      `CREATE TABLE IF NOT EXISTS chats (id SERIAL PRIMARY KEY, name VARCHAR(50), is_group BOOLEAN DEFAULT false, creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL, invite_code VARCHAR(16) UNIQUE);`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_chats_invite_code ON chats(invite_code);`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS chat_users (id SERIAL PRIMARY KEY, chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL);`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE, sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, deleted_for INTEGER[] DEFAULT '{}'::integer[]);`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS friends (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(user_id, friend_id));`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS registration_codes (email VARCHAR(255) PRIMARY KEY NOT NULL, username VARCHAR(50) NOT NULL, password TEXT NOT NULL, avatar_url TEXT, code VARCHAR(6) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`
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

    console.log("DB initialized.");
  } catch (e) {
    console.error("DB Init Error:", e);
    process.exit(1);
  }
}

async function start() {
  await initializeDatabase();
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start();