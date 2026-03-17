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
}

interface IncomingRequestRow {
  requester_id: number;
  requester_name: string;
  requester_avatar: string | null;
}

router.get("/", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = (req.user as any).id;
  try {
    const result = await client.query<FriendRow>(
      `SELECT DISTINCT u.id, u.username, u.avatar_url
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
  const userId = (req.user as any).id;
  const { friendId } = req.body as FriendBody;
  
  try {
    await client.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending')`,
      [userId, friendId]
    );
    
    const io: Server = req.app.get("io");
    io.to(`user_${friendId}`).emit("new_friend_request");
    
    res.json({ message: "Запрос отправлен" });
  } catch (err: any) {
    if (err.code === "23505") { 
      err.status = 409;
      err.message = "Запрос уже отправлен или вы уже друзья.";
    }
    next(err);
  }
});

router.post("/accept", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = (req.user as any).id;
  const { friendId } = req.body as FriendBody;
  
  try {
    await client.query(
      `UPDATE friends SET status='accepted'
       WHERE user_id=$1 AND friend_id=$2 AND status='pending'`,
      [friendId, userId]
    );
    
    const io: Server = req.app.get("io");
    io.to(`user_${friendId}`).emit("friend_request_accepted");
    
    res.json({ message: "Запрос принят" });
  } catch (e) {
    next(e);
  }
});

router.post("/remove", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = (req.user as any).id;
  const { friendId } = req.body as FriendBody;
  
  try {
    await client.query(
      `DELETE FROM friends
       WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)`,
      [userId, friendId]
    );
    
    const io: Server = req.app.get("io");
    io.to(`user_${friendId}`).emit("friend_removed", { byUserId: userId });
    
    res.json({ message: "Друг удалён" });
  } catch (err) {
    next(err);
  }
});

router.get("/incoming", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = (req.user as any).id;
  try {
    const result = await client.query<IncomingRequestRow>(
      `SELECT f.user_id as requester_id, u.username as requester_name, u.avatar_url as requester_avatar
       FROM friends f JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) {
    next(e);
  }
});

export default router;