import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { secret } from "../config"; // Убедитесь, что config.ts существует

// Расширяем интерфейс Request, чтобы TypeScript знал о поле user
export interface AuthRequest extends Request {
  user?: string | JwtPayload;
}

export default function (req: AuthRequest, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      const err: any = new Error("Нет токена");
      err.status = 403;
      return next(err);
    }

    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer" || !token) {
      const err: any = new Error("Неверный формат токена");
      err.status = 403;
      return next(err);
    }

    try {
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      return next();
    } catch (e: any) {
      if (e.name === "TokenExpiredError") {
        // req.headers[...] может вернуть string | string[] | undefined
        // Приводим к string, так как ожидаем один токен
        const refreshToken = req.headers["x-refresh-token"] as string;

        if (!refreshToken) {
          const err: any = new Error("Токен истёк, нужен refreshToken");
          err.status = 401;
          return next(err);
        }

        try {
          const userData = jwt.verify(refreshToken, secret) as JwtPayload;

          const newAccessToken = jwt.sign(
            { id: userData.id, role: userData.role },
            secret,
            { expiresIn: "15m" }
          );

          res.setHeader("x-access-token", newAccessToken);
          req.user = userData;
          return next();
        } catch (refreshError: any) {
          console.warn(
            `[AuthMiddleware] Ошибка Refresh-токена: ${refreshError.message}`
          );
          const err: any = new Error("Refresh токен недействителен");
          err.status = 403;
          return next(err);
        }
      } else {
        console.warn(`[AuthMiddleware] Ошибка Access-токена: ${e.message}`);
        const err: any = new Error("Пользователь не авторизован (токен невалиден)");
        err.status = 403;
        return next(err);
      }
    }
  } catch (e: any) {
    console.error(
      "❗️ Критическая ошибка в authMiddleware:",
      e.message,
      e.stack
    );
    next(e);
  }
}