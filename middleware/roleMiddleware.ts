import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { secret } from "../config";

// Интерфейс для полезной нагрузки токена
interface UserJwtPayload extends JwtPayload {
  role: string;
}

export default function (roles: string | string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (req.method === "OPTIONS") {
      return next();
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        const err: any = new Error("Пользователь не авторизован (нет хедера)");
        err.status = 403;
        return next(err);
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        const err: any = new Error("Пользователь не авторизован (нет токена)");
        err.status = 403;
        return next(err);
      }

      // Проверяем токен и приводим к нашему типу
      const decoded = jwt.verify(token, secret) as UserJwtPayload;
      const userRole = decoded.role;
      
      let hasRole = false;

      if (Array.isArray(roles)) {
        if (roles.includes(userRole)) {
          hasRole = true;
        }
      } else {
        hasRole = userRole === roles;
      }

      if (!hasRole) {
        const err: any = new Error("НЕТ ДОСТУПА");
        err.status = 403;
        return next(err);
      }

      next();
    } catch (e: any) {
      console.error("❗️ Ошибка в roleMiddleware:", e.message);

      const err: any = new Error("Пользователь не авторизован (ошибка токена)");
      err.status = 403;

      if (e.name === "TokenExpiredError") {
        err.status = 401;
        err.message = "Токен истёк";
      }

      return next(err);
    }
  };
};