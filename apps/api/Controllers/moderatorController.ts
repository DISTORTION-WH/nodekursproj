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
      
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${userId}`).emit("auth_error", { message: "Ваш аккаунт был забанен." });
        
        io.in(`user_${userId}`).disconnectSockets(true);
        console.log(`🔌 Sockets for user ${userId} have been disconnected.`);
      }

      logger.warn(`Пользователь ${userId} был забанен модератором ${req.user?.id}`);
      res.json({ message: `Пользователь (ID: ${userId}) забанен и отключен от системы.` });
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




async getReports(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await client.query(`
        SELECT 
          r.id, 
          r.reason, 
          r.status, 
          r.created_at,
          r.message_id,
          m.text as message_text,
          u_sender.id as sender_id,
          u_sender.username as sender_name,
          u_reporter.username as reporter_name
        FROM reports r
        JOIN messages m ON r.message_id = m.id
        JOIN users u_sender ON m.sender_id = u_sender.id
        JOIN users u_reporter ON r.reporter_id = u_reporter.id
        WHERE r.status = 'pending'
        ORDER BY r.created_at DESC
      `);
      res.json(result.rows);
    } catch (e: any) {
      next(e);
    }
  }

  async dismissReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reportId } = req.body;
      await client.query("UPDATE reports SET status = 'dismissed' WHERE id = $1", [reportId]);
      res.json({ message: "Жалоба отклонена" });
    } catch (e: any) {
      next(e);
    }
  }

  async deleteMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { messageId, reportId } = req.body;

      await client.query("DELETE FROM messages WHERE id = $1", [messageId]);
      
      if (reportId) {
        await client.query("UPDATE reports SET status = 'resolved' WHERE id = $1", [reportId]);
      }

      const io = req.app.get("io");
      if (io) {
      }

      logger.warn(`Модератор ${req.user?.id} удалил сообщение ${messageId}`);
      res.json({ message: "Сообщение удалено" });
    } catch (e: any) {
      next(e);
    }
  }


}

export default new ModeratorController();