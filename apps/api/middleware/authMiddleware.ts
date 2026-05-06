import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { secret } from "../config";
import client from "../databasepg";

export interface AuthUser {
  id: number;
  role: string;
  username?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

interface DecodedToken extends JwtPayload {
  id: number;
  role: string;
}

export default async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ message: "Пользователь не авторизован" });
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "Пользователь не авторизован" });
      return;
    }

    let decoded: DecodedToken;
    try {
      decoded = jwt.verify(token, secret) as DecodedToken;
    } catch (jwtErr: unknown) {
      const err = jwtErr as Error;
      if (err.name === "TokenExpiredError") {
        res.status(401).json({ message: "Токен истёк" });
      } else {
        res.status(401).json({ message: "Пользователь не авторизован" });
      }
      return;
    }

    if (typeof decoded.id !== "number") {
      res.status(401).json({ message: "Некорректный токен" });
      return;
    }

    (req as AuthRequest).user = { id: decoded.id, role: decoded.role };

    try {
      const userRes = await client.query<{ is_banned: boolean }>(
        "SELECT is_banned FROM users WHERE id = $1",
        [decoded.id]
      );
      if (userRes.rows.length === 0) {
        res.status(401).json({ message: "Пользователь не найден" });
        return;
      }
      if (userRes.rows[0].is_banned) {
        console.warn(`Blocked request from BANNED user: ${decoded.id}`);
        res.status(403).json({ message: "Ваш аккаунт заблокирован" });
        return;
      }
    } catch (dbErr: unknown) {
      const err = dbErr as Error;
      console.error("AuthMiddleware DB Error:", err.message);
      res.status(503).json({ message: "Сервис временно недоступен" });
      return;
    }

    next();
  } catch (e: unknown) {
    const err = e as Error;
    console.error("AuthMiddleware unexpected error:", err.message);
    res.status(401).json({ message: "Пользователь не авторизован" });
  }
}
