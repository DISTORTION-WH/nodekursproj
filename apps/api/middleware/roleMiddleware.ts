import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { secret } from "../config";
import client from "../databasepg"; // Импортируем клиент БД для проверки актуальной роли

interface UserJwtPayload extends JwtPayload {
  id: number;
  role: string;
}

export default function (roles: string | string[]) {
  // Делаем функцию асинхронной для запроса к БД
  return async function (req: Request, res: Response, next: NextFunction) {
    if (req.method === "OPTIONS") {
      return next();
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(403).json({ message: "Пользователь не авторизован (нет хедера)" });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(403).json({ message: "Пользователь не авторизован (нет токена)" });
      }

      // Декодируем токен чтобы получить ID
      const decoded = jwt.verify(token, secret) as UserJwtPayload;
      
      // ИЗМЕНЕНИЕ: Запрашиваем актуальную роль из БД вместо доверия токену
      const userRes = await client.query(
        `SELECT r.value as role 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id 
         WHERE u.id = $1`, 
        [decoded.id]
      );

      if (userRes.rows.length === 0) {
        return res.status(403).json({ message: "Пользователь не найден" });
      }

      // Если роль не назначена, считаем USER
      const currentRole = userRes.rows[0].role || "USER";
      
      let hasRole = false;
      if (Array.isArray(roles)) {
        if (roles.includes(currentRole)) {
          hasRole = true;
        }
      } else {
        hasRole = currentRole === roles;
      }

      if (!hasRole) {
        return res.status(403).json({ message: "НЕТ ДОСТУПА" });
      }

      next();
    } catch (e: any) {
      console.error("❗️ Ошибка в roleMiddleware:", e.message);

      if (e.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Токен истёк" });
      }

      return res.status(403).json({ message: "Пользователь не авторизован" });
    }
  };
};