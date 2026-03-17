import { Request, Response, NextFunction } from "express";
import client from "../databasepg";
import chatService from "../Services/chatService";
import userService from "../Services/userService";
import logService from "../Services/logService";

class AdminController {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [usersRes, chatsRes, messagesRes, logsRes] = await Promise.all([
        client.query("SELECT COUNT(*) FROM users"),
        client.query("SELECT COUNT(*) FROM chats"),
        client.query("SELECT COUNT(*) FROM messages"),
        client.query("SELECT COUNT(*) FROM app_logs WHERE level = 'ERROR'") 
      ]);

      res.json({
        usersCount: parseInt(usersRes.rows[0].count, 10),
        chatsCount: parseInt(chatsRes.rows[0].count, 10),
        messagesCount: parseInt(messagesRes.rows[0].count, 10),
        logsCount: parseInt(logsRes.rows[0].count, 10),
      });
    } catch (e: any) {
      next(e);
    }
  }

  async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await logService.getRecentLogs(50);
      res.json(logs);
    } catch (e: any) {
      next(e);
    }
  }

  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usersRes = await client.query(`
        SELECT u.id, u.username, u.email, u.created_at, u.avatar_url, r.value as role, u.is_banned
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
        SELECT u.id, u.username, u.email, u.avatar_url, r.value as role, u.is_banned
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

  // ИСПРАВЛЕННЫЙ МЕТОД: Используем chatService для получения полных данных (сообщения + участники)
  async getAllChats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Вместо сырого SQL запроса используем сервис, который подтягивает messages и participants
      const chats = await chatService.getAllChats();
      res.json(chats);
    } catch (e: any) {
      next(e);
    }
  }

  async deleteChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      // Используем chatService для полного удаления (включая сообщения и участников)
      await chatService.deleteChatAndData(id);
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