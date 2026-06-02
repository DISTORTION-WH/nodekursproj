import { Router, Response, NextFunction } from "express";
import client from "../databasepg";
import authMiddleware, { AuthRequest } from "../middleware/authMiddleware";
import { Server } from "socket.io";

const router = Router();

interface FriendBody {
  friendId: number;
}

interface FriendRow {
  id: number;
  username: string;
  avatar_url: string | null;
  avatar_frame?: string | null;
  is_banned?: boolean;
}

interface IncomingRequestRow {
  requester_id: number;
  requester_name: string;
  requester_avatar: string | null;
}

router.get("/", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  try {
    const result = await client.query<FriendRow>(
      `SELECT DISTINCT u.id, u.username, u.avatar_url, u.avatar_frame, u.is_banned
       FROM users u
       JOIN friends f ON (u.id = f.friend_id OR u.id = f.user_id)
       WHERE (f.user_id = $1 OR f.friend_id = $1)
         AND f.status='accepted'
         AND u.id != $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post("/request", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const { friendId } = req.body as FriendBody;
  const targetId = Number(friendId);

  if (isNaN(targetId) || targetId <= 0) {
    res.status(400).json({ message: "Некорректный ID пользователя" });
    return;
  }
  if (targetId === userId) {
    res.status(400).json({ message: "Нельзя добавить самого себя в друзья" });
    return;
  }

  try {
    // Verify target user exists and is not banned
    const targetRes = await client.query<{ id: number; is_banned: boolean }>(
      "SELECT id, is_banned FROM users WHERE id = $1",
      [targetId]
    );
    if (targetRes.rows.length === 0) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    if (targetRes.rows[0].is_banned) {
      res.status(400).json({ message: "Нельзя отправить запрос заблокированному пользователю" });
      return;
    }

    // Check no existing relationship
    const existingRes = await client.query(
      "SELECT id FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)",
      [userId, targetId]
    );
    if (existingRes.rows.length > 0) {
      res.status(409).json({ message: "Запрос уже отправлен или вы уже друзья" });
      return;
    }

    await client.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending')`,
      [userId, targetId]
    );

    const io: Server = req.app.get("io");
    io.to(`user_${targetId}`).emit("new_friend_request");

    res.json({ message: "Запрос отправлен" });
  } catch (err: unknown) {
    next(err);
  }
});

router.post("/accept", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const { friendId } = req.body as FriendBody;
  const targetId = Number(friendId);

  if (isNaN(targetId) || targetId <= 0) {
    res.status(400).json({ message: "Некорректный ID пользователя" });
    return;
  }

  try {
    const result = await client.query(
      `UPDATE friends SET status='accepted'
       WHERE user_id=$1 AND friend_id=$2 AND status='pending'`,
      [targetId, userId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Запрос не найден" });
      return;
    }

    const io: Server = req.app.get("io");
    io.to(`user_${targetId}`).emit("friend_request_accepted");

    res.json({ message: "Запрос принят" });
  } catch (e: unknown) {
    next(e);
  }
});

router.post("/remove", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const { friendId } = req.body as FriendBody;
  const targetId = Number(friendId);

  if (isNaN(targetId) || targetId <= 0) {
    res.status(400).json({ message: "Некорректный ID пользователя" });
    return;
  }

  try {
    // Prevent removing LumeOfficial from friends
    const lumeCheck = await client.query("SELECT id FROM users WHERE username = 'LumeOfficial' AND id = $1", [targetId]);
    if (lumeCheck.rows.length > 0) {
      res.status(403).json({ message: "Нельзя удалить LumeOfficial из друзей" });
      return;
    }

    await client.query(
      `DELETE FROM friends
       WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)`,
      [userId, targetId]
    );

    const io: Server = req.app.get("io");
    io.to(`user_${targetId}`).emit("friend_removed", { byUserId: userId });

    res.json({ message: "Друг удалён" });
  } catch (err: unknown) {
    next(err);
  }
});

router.get("/incoming", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  try {
    const result = await client.query<IncomingRequestRow>(
      `SELECT f.user_id as requester_id, u.username as requester_name, u.avatar_url as requester_avatar
       FROM friends f JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    res.json(result.rows);
  } catch (e: unknown) {
    next(e);
  }
});

// Returns friendship status with a specific user: 'none' | 'pending_sent' | 'pending_received' | 'accepted'
router.get("/status/:userId", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const myId = req.user!.id;
  const userIdParam = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const otherId = parseInt(userIdParam, 10);
  if (isNaN(otherId)) { res.status(400).json({ status: "none" }); return; }
  try {
    const result = await client.query(
      `SELECT status, user_id FROM friends
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [myId, otherId]
    );
    if (result.rows.length === 0) {
      res.json({ status: "none" });
      return;
    }
    const row = result.rows[0];
    if (row.status === "accepted") { res.json({ status: "accepted" }); return; }
    if (Number(row.user_id) === Number(myId)) {
      res.json({ status: "pending_sent" });
    } else {
      res.json({ status: "pending_received" });
    }
  } catch (e: unknown) {
    next(e);
  }
});

export default router;
