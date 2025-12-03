import { Request, Response, NextFunction } from "express";
import client from "../databasepg";
import logger from "../Services/logService"; 
import { AuthRequest } from "../middleware/authMiddleware";

interface CustomError extends Error {
  status?: number;
}

class ModeratorController {
  
  async warnUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, reason } = req.body;
      const moderatorId = req.user?.id; 

      if (!userId || !reason) {
        const err = new Error("Не указан ID пользователя или причина") as CustomError;
        err.status = 400;
        return next(err);
      }

      const userCheck = await client.query("SELECT id FROM users WHERE id = $1", [userId]);
      if (userCheck.rows.length === 0) {
        const err = new Error("Пользователь не найден") as CustomError;
        err.status = 404;
        return next(err);
      }

      await client.query(
        "INSERT INTO warnings (user_id, moderator_id, reason) VALUES ($1, $2, $3)",
        [userId, moderatorId, reason]
      );

      logger.warn(`Пользователь ${userId} получил предупреждение: ${reason}`);
      
      res.json({ message: `Пользователю (ID: ${userId}) выдано предупреждение. Причина: ${reason}` });
    } catch (e: any) {
      next(e);
    }
  }

  async banUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        const err = new Error("Не указан ID пользователя") as CustomError;
        err.status = 400;
        return next(err);
      }

      const targetUser = await client.query(
        `SELECT u.id, r.value as role 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id 
         WHERE u.id = $1`, 
        [userId]
      );

      if (targetUser.rows.length === 0) {
        const err = new Error("Пользователь не найден") as CustomError;
        err.status = 404;
        return next(err);
      }

      const role = targetUser.rows[0].role;
      if (role === 'ADMIN' || role === 'MODERATOR') {
        const err = new Error("Нельзя забанить администратора или модератора") as CustomError;
        err.status = 403;
        return next(err);
      }

      await client.query("UPDATE users SET is_banned = true WHERE id = $1", [userId]);
      
      logger.warn(`Пользователь ${userId} был забанен модератором ${req.user?.id}`);
      res.json({ message: `Пользователь (ID: ${userId}) забанен.` });
    } catch (e: any) {
      next(e);
    }
  }

  async unbanUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.body;

      if (!userId) {
        const err = new Error("Не указан ID пользователя") as CustomError;
        err.status = 400;
        return next(err);
      }

      await client.query("UPDATE users SET is_banned = false WHERE id = $1", [userId]);
      
      logger.info(`Пользователь ${userId} был разбанен модератором ${req.user?.id}`);
      res.json({ message: `Пользователь (ID: ${userId}) разбанен.` });
    } catch (e: any) {
      next(e);
    }
  }
}

export default new ModeratorController();