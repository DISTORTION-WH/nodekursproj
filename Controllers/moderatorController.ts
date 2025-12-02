import { Request, Response, NextFunction } from "express";
import client from "../databasepg";

interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role?: string;
  };
}

class ModeratorController {
  async warnUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, reason } = req.body;
      
      if (!userId || !reason) {
        res.status(400).json({ message: "Не указан ID пользователя или причина" });
        return;
      }

      const botRes = await client.query("SELECT id FROM users WHERE username = 'LumeOfficial'");
      if (botRes.rows.length === 0) {
        res.status(500).json({ message: "System user not found" });
        return;
      }
      const lumeId = botRes.rows[0].id;

      let chatId;
      const chatRes = await client.query(`
        SELECT c.id 
        FROM chats c
        JOIN chat_users cu1 ON c.id = cu1.chat_id
        JOIN chat_users cu2 ON c.id = cu2.chat_id
        WHERE c.is_group = false 
          AND ((cu1.user_id = $1 AND cu2.user_id = $2) OR (cu1.user_id = $2 AND cu2.user_id = $1))
        LIMIT 1
      `, [lumeId, userId]);

      if (chatRes.rows.length > 0) {
        chatId = chatRes.rows[0].id;
      } else {
        const newChat = await client.query(
          "INSERT INTO chats (is_group) VALUES (false) RETURNING id"
        );
        chatId = newChat.rows[0].id;

        await client.query(
          "INSERT INTO chat_users (chat_id, user_id) VALUES ($1, $2), ($1, $3)",
          [chatId, lumeId, userId]
        );
      }

      const warningText = `⚠️ ПРЕДУПРЕЖДЕНИЕ: ${reason}. Пожалуйста, соблюдайте правила.`;

      const msgRes = await client.query(
        "INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *",
        [chatId, lumeId, warningText]
      );

      const io = req.app.get("io");
      const msgWithSender = { ...msgRes.rows[0], sender_name: "LumeOfficial" };

      io.to(`chat_${chatId}`).emit("new_message", msgWithSender);
      io.to(`user_${userId}`).emit("update_chat_list", { chatId, lastMessage: msgWithSender });
      io.to(`user_${userId}`).emit("notification", { type: 'warning', message: warningText });

      res.json({ message: "Предупреждение отправлено" });
    } catch (e) {
      next(e);
    }
  }

  async banUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.body;
      await client.query("UPDATE users SET is_banned = true WHERE id = $1", [userId]);
      
      const io = req.app.get("io");
      io.to(`user_${userId}`).emit("force_logout", { message: "Account blocked" });

      res.json({ message: "Пользователь заблокирован" });
    } catch (e) {
      next(e);
    }
  }

  async unbanUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.body;
      await client.query("UPDATE users SET is_banned = false WHERE id = $1", [userId]);
      res.json({ message: "Пользователь разблокирован" });
    } catch (e) {
      next(e);
    }
  }
}

export default new ModeratorController();