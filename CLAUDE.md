# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack chat application with real-time messaging, group chats, friend system, file uploads to Cloudflare R2, and role-based moderation (USER / MODERATOR / ADMIN). Backend is Express + TypeScript + PostgreSQL + Socket.io; frontend is React 19 + TypeScript.

## Development Commands

### Backend (root directory)
```bash
npm run start:dev   # Nodemon dev server on port 5000
npm run build       # tsc → dist/
npm start           # node dist/index.js (production)
```

### Frontend (Frontend/front/)
```bash
npm start           # React dev server on port 3000
npm run build       # Production build
npm test            # Jest tests
```

### Docker (full stack)
```bash
docker-compose up --build   # Start all services (DB, backend, frontend)
docker-compose down         # Stop all services
```

## Required Environment Variables

Copy `.env` at the project root. Key variables:

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` | PostgreSQL connection |
| `DATABASE_URL` | Production connection string (overrides individual params) |
| `JWT_SECRET` | Signing access + refresh tokens |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`, `MINIO_PUBLIC_URL` | Cloudflare R2 file storage |
| `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` | Email verification |
| `REACT_APP_API_URL` | Frontend API base URL (defaults to `http://localhost:5000`) |

## Architecture

### Backend layers

```
index.ts            → Express app + Socket.io init + DB table creation (idempotent)
databasepg.ts       → pg Pool (SSL for prod, plain for dev)
config.ts           → Typed env var exports

Routes/             → Route registration only; maps paths to controller functions
Controllers/        → HTTP handlers: validate input, call service, return response
Services/           → All database queries and business logic
middleware/
  authMiddleware.ts → Verifies JWT, checks user not banned, attaches req.user
  roleMiddleware.ts → Accepts allowed roles array; reads role from DB on each request
```

### Frontend layers

```
src/
  App.tsx           → Router setup; wraps everything in AuthProvider → SocketProvider → ChatProvider → CallProvider
  services/api.tsx  → Axios instance; intercepts 401 to auto-refresh token or logout
  context/          → AuthContext (tokens/user), SocketContext (socket.io-client), ChatContext (active chat), CallContext (WebRTC)
  pages/            → Full-page views (HomePage, AdminPage, ModeratorPage, ProfilePage, UserProfilePage)
  components/       → Reusable UI (ChatWindow, MessageList, MessageInput, ChatModals, FriendsList, etc.)
  types.ts          → All shared TypeScript interfaces
```

### Auth flow

- Registration requires a pre-issued `registration_codes` email code.
- Login returns `accessToken` (15 min) + `refreshToken` (30 days) stored in `localStorage`.
- The Axios interceptor in `api.tsx` calls `POST /auth/refresh` automatically on 401.
- Socket.io connections authenticate via JWT passed in `auth.token` on connect; the server middleware verifies it before allowing socket events.

### Real-time (Socket.io)

- Each authenticated user joins room `user_${userId}`.
- Each chat has room `chat_${chatId}`.
- Key events: `new_message`, `message_deleted`, `chat_created`, `call_offer`, `call_answer`, `ice_candidate`, `call_ended`.
- WebRTC signaling (offer/answer/ICE) is relayed through the socket server for P2P voice/video calls.

### Database

Tables are created in `index.ts` on startup (`CREATE TABLE IF NOT EXISTS`). No migration framework — schema changes must be applied manually or via `DROP TABLE` + restart.

Key relationships:
- `users` → `roles` (many-to-one)
- `chat_users` — join table for many-to-many users↔chats, includes `invited_by`
- `messages.deleted_for` — integer array for per-user soft-delete
- `friends` — bidirectional with `status` (`pending` / `accepted`)
- `reports` → messages/users for moderation; `warnings` → users

### File uploads

Avatars and other files go to Cloudflare R2 via the MinIO SDK (`Services/minioService.ts`). Multer handles the multipart upload on the backend; public URLs use `MINIO_PUBLIC_URL`.

## Key Conventions

- All backend source is TypeScript compiled to `dist/`; never edit files in `dist/`.
- `roleMiddleware` accepts a roles array, e.g. `roleMiddleware(['ADMIN', 'MODERATOR'])`.
- Frontend API calls go through the shared Axios instance in `services/api.tsx` — do not create ad-hoc axios instances.
- Chat-related Socket.io logic lives in `chatController.ts` / `chatService.ts`; call signaling is in `index.ts` socket setup.
