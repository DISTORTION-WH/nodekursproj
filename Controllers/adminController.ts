import { Request, Response, NextFunction } from "express";
import client from "../databasepg";
import chatService from "../Services/chatService";
import userService from "../Services/userService";

class AdminController {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userCountRes = await client.query("SELECT COUNT(*) FROM users");
      const chatCountRes = await client.query("SELECT COUNT(*) FROM chats");
      const msgCountRes = await client.query("SELECT COUNT(*) FROM messages");

      const activeUsersRes = await client.query(`
        SELECT COUNT(DISTINCT sender_id) 
        FROM messages 
        WHERE created_at > NOW() - INTERVAL '24 HOURS'
      `);

      res.json({
        totalUsers: parseInt(userCountRes.rows[0].count, 10),
        totalChats: parseInt(chatCountRes.rows[0].count, 10),
        totalMessages: parseInt(msgCountRes.rows[0].count, 10),
        activeUsers24h: parseInt(activeUsersRes.rows[0].count, 10),
      });
    } catch (e: any) {
      next(e);
    }
  }

  async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {

      res.json([
        { id: 1, type: "info", message: "System started", timestamp: new Date() },
        { id: 2, type: "warning", message: "High load detected", timestamp: new Date(Date.now() - 3600000) },
      ]);
    } catch (e: any) {
      next(e);
    }
  }

  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usersRes = await client.query(`
        SELECT u.id, u.username, u.email, u.created_at, u.avatar_url, r.value as role
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        ORDER BY u.id ASC
      `);
      res.json(usersRes.rows);
    } catch (e: any) {
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
        SELECT u.id, u.username, u.email, u.avatar_url, r.value as role
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.username ILIKE $1 OR u.email ILIKE $1
        LIMIT 20
      `, [`%${q}%`]);
      
      res.json(usersRes.rows);
    } catch (e: any) {
      next(e);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { role, username, email } = req.body;

      if (role) {
        const roleRes = await client.query("SELECT id FROM roles WHERE value = $1", [role]);
        if (roleRes.rows.length > 0) {
           const roleId = roleRes.rows[0].id;
           await client.query("UPDATE users SET role_id = $1 WHERE id = $2", [roleId, id]);
        }
      }

      if (username) {
        await client.query("UPDATE users SET username = $1 WHERE id = $2", [username, id]);
      }

      res.json({ message: "User updated successfully" });
    } catch (e: any) {
      next(e);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await client.query("DELETE FROM users WHERE id = $1", [id]);
      res.json({ message: "User deleted" });
    } catch (e: any) {
      next(e);
    }
  }

  async getAllChats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatsRes = await client.query(`
        SELECT c.id, c.name, c.is_group, c.created_at, u.username as creator_name,
        (SELECT COUNT(*) FROM chat_users cu WHERE cu.chat_id = c.id) as members_count
        FROM chats c
        LEFT JOIN users u ON c.creator_id = u.id
        ORDER BY c.created_at DESC
        LIMIT 100
      `);
      res.json(chatsRes.rows);
    } catch (e: any) {
      next(e);
    }
  }

  async deleteChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await client.query("DELETE FROM chats WHERE id = $1", [id]);
      res.json({ message: "Chat deleted" });
    } catch (e: any) {
      next(e);
    }
  }

  async broadcastMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text } = req.body;
      if (!text) {
        res.status(400).json({ message: "Текст сообщения обязателен" });
        return;
      }

      const systemUser = await userService.findUserByUsername("LumeOfficial");
      if (!systemUser) {
        res.status(500).json({ message: "Системный пользователь не найден" });
        return;
      }

      const allUsersResult = await client.query(
        "SELECT id FROM users WHERE id != $1",
        [systemUser.id]
      );
      const allUsers = allUsersResult.rows;

      const io = req.app.get("io");
      let count = 0;

      for (const user of allUsers) {
        try {
          const chat = await chatService.findOrCreatePrivateChat(systemUser.id, user.id);
          
          await client.query(
            `INSERT INTO friends (user_id, friend_id, status) 
             VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted') 
             ON CONFLICT DO NOTHING`,
            [user.id, systemUser.id]
          );
          
          const savedMessage = await chatService.postMessage(chat.id, systemUser.id, text);

          if (io) {
            io.to(`user_${user.id}`).emit("update_chat_list", {
               chatId: chat.id,
               lastMessage: savedMessage
            });
            io.to(`chat_${chat.id}`).emit("receive_message", savedMessage);
          }
          count++;
        } catch (err) {
          console.error(`Ошибка отправки пользователю ${user.id}:`, err);
        }
      }

      res.json({ message: `Рассылка успешно выполнена для ${count} пользователей` });
    } catch (e: any) {
      console.error("Broadcast Error:", e);
      next(e);
    }
  }
}

export default new AdminController();