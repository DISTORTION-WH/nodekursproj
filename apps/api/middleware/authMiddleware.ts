import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { secret } from "../config";
import client from "../databasepg"; 

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    [key: string]: any;
  };
}

export default async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Пользователь не авторизован" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Пользователь не авторизован" });
    }

    const decoded = jwt.verify(token, secret) as any;
    
    (req as AuthRequest).user = decoded;

    try {
      const userRes = await client.query("SELECT is_banned FROM users WHERE id = $1", [decoded.id]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({ message: "Пользователь не найден" });
      }
      if (userRes.rows[0].is_banned) {
          console.warn(`Blocked request from BANNED user: ${decoded.id}`);
          return res.status(403).json({ message: "Ваш аккаунт заблокирован" });
      }
    } catch (dbErr) {
      console.error("AuthMiddleware DB Error:", dbErr);
      return res.status(503).json({ message: "Сервис временно недоступен" });
    }

    next();
  } catch (e) {
    console.error(e);
    return res.status(401).json({ message: "Пользователь не авторизован" });
  }
}
