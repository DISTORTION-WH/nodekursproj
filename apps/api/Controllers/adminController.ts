import { Request, Response, NextFunction } from "express";
import client from "../databasepg";
import chatService from "../Services/chatService";
import userService from "../Services/userService";
import logService from "../Services/logService";

class AdminController {
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [usersRes, chatsRes, messagesRes, logsRes] = await Promise.all([
        client.query("SELECT COUNT(*) FROM users"),
        client.query("SELECT COUNT(*) FROM chats"),
        client.query("SELECT COUNT(*) FROM messages"),
        client.query("SELECT COUNT(*) FROM app_logs WHERE level = 'ERROR'"),
      ]);

      res.json({
        usersCount: parseInt(usersRes.rows[0].count, 10),
        chatsCount: parseInt(chatsRes.rows[0].count, 10),
        messagesCount: parseInt(messagesRes.rows[0].count, 10),
        logsCount: parseInt(logsRes.rows[0].count, 10),
      });
    } catch (e: unknown) {
      next(e);
    }
  }

  async getLogs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await logService.getRecentLogs(50);
      res.json(logs);
    } catch (e: unknown) {
      next(e);
    }
  }

  async getAllUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usersRes = await client.query(`
        SELECT u.id, u.username, u.email, u.created_at, u.avatar_url, r.value as role, u.is_banned
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        ORDER BY u.id ASC
      `);
      res.json(usersRes.rows);
    } catch (e: unknown) {
      next(e);
    }
  }

  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      if (!q) {
        res.json([]);
        return;
      }

      const usersRes = await client.query(`
        SELECT u.id, u.username, u.email, u.avatar_url, r.value as role, u.is_banned
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.username ILIKE $1 OR u.email ILIKE $1
        LIMIT 20
      `, [`%${q}%`]);

      res.json(usersRes.rows);
    } catch (e: unknown) {
      next(e);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { role, username } = req.body as { role?: string; username?: string };

      if (role) {
        const roleRes = await client.query<{ id: number }>("SELECT id FROM roles WHERE value = $1", [role]);
        if (roleRes.rows.length > 0) {
          await client.query("UPDATE users SET role_id = $1 WHERE id = $2", [roleRes.rows[0].id, id]);
        }
      }

      if (username) {
        await client.query("UPDATE users SET username = $1 WHERE id = $2", [username, id]);
      }

      res.json({ message: "User updated successfully" });
    } catch (e: unknown) {
      next(e);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await client.query("DELETE FROM users WHERE id = $1", [id]);
      res.json({ message: "User deleted" });
    } catch (e: unknown) {
      next(e);
    }
  }

  async getAllChats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chats = await chatService.getAllChats();
      res.json(chats);
    } catch (e: unknown) {
      next(e);
    }
  }

  async deleteChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await chatService.deleteChatAndData(id as string);
      res.json({ message: "Chat deleted" });
    } catch (e: unknown) {
      next(e);
    }
  }

  async broadcastMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text } = req.body as { text?: string };
      if (!text || !text.trim()) {
        res.status(400).json({ message: "Текст сообщения обязателен" });
        return;
      }

      const systemUser = await userService.findUserByUsername("LumeOfficial");
      if (!systemUser) {
        res.status(500).json({ message: "Системный пользователь не найден" });
        return;
      }

      // Get all users and their existing chats with LumeOfficial in one query to avoid N+1
      const allUsersResult = await client.query<{ id: number }>(
        "SELECT id FROM users WHERE id != $1",
        [systemUser.id]
      );
      const allUsers = allUsersResult.rows;

      const io = req.app.get("io");
      let count = 0;

      for (const user of allUsers) {
        try {
          const chat = await chatService.findOrCreatePrivateChat(systemUser.id, user.id);
          const savedMessage = await chatService.postMessage(chat.id, systemUser.id, text.trim());

          if (io) {
            io.to(`user_${user.id}`).emit("update_chat_list", {
              chatId: chat.id,
              lastMessage: savedMessage,
            });
            io.to(`chat_${chat.id}`).emit("receive_message", savedMessage);
          }
          count++;
        } catch (err) {
          console.error(`Ошибка отправки пользователю ${user.id}:`, err);
        }
      }

      res.json({ message: `Рассылка успешно выполнена для ${count} пользователей` });
    } catch (e: unknown) {
      console.error("Broadcast Error:", e);
      next(e);
    }
  }
}

export default new AdminController();
