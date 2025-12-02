import { Request, Response, NextFunction } from 'express';
import userService from "../Services/userService";
import chatService from "../Services/chatService";
import adminService from "../Services/adminService";
import logService from "../Services/logService";
import client from "../databasepg";
class AdminController {
  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (e) {
      next(e);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { username, roleId, email } = req.body;
      
      const updated = await userService.updateUser(id, {
        username,
        roleId,
        email,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.json({ message: "Пользователь удалён" });
    } catch (e) {
      next(e);
    }
  }

  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query.q as string; 
      const result = await userService.searchUsers(q);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }

  async deleteChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await adminService.deleteChat(id);
      res.json({ message: "Чат и все его данные удалены" });
    } catch (e) {
      next(e);
    }
  }

  async getAllChats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chats = await chatService.getAllChats();
      res.json(chats);
    } catch (e) {
      next(e);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getAppStats();
      res.json(stats);
    } catch (e) {
      next(e);
    }
  }

  async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const logs = await logService.getRecentLogs(limit);
      res.json(logs);
    } catch (e) {
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
}}

export default new AdminController();