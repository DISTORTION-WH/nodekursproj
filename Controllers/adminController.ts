import { Request, Response, NextFunction } from 'express';
import userService from "../Services/userService";
import chatService from "../Services/chatService";
import adminService from "../Services/adminService";
import logService from "../Services/logService";

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
}

export default new AdminController();