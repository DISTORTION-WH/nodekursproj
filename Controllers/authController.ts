import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { secret } from '../config';
import userService from "../Services/userService";
import roleService from "../Services/roleService";
import emailService from "../Services/emailService"; // Исправленный импорт
import minioService from "../Services/minioService";

interface CustomError extends Error {
  status?: number;
  errors?: any[];
}

interface TokenPayload {
  id: number | string;
  role: string;
}

const generateAccessToken = (id: number | string, role: string): string => {
  const payload: TokenPayload = { id, role };
  return jwt.sign(payload, secret, { expiresIn: "15m" });
};

const generateRefreshToken = (id: number | string, role: string): string => {
  const payload: TokenPayload = { id, role };
  return jwt.sign(payload, secret, { expiresIn: "30d" });
};

class AuthController {
  async preRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const firstError = errors.array()[0];
        const err = new Error(firstError.msg) as CustomError;
        err.status = 400;
        err.errors = errors.array();
        return next(err);
      }

      const { username, password, email } = req.body;
      const avatarFile = req.file;

      const candidate = await userService.findUserByUsername(username);
      if (candidate) {
        const err = new Error("Пользователь с таким именем уже существует") as CustomError;
        err.status = 400;
        return next(err);
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      // Генерируем 6-значный код
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      let avatarUrl = null;
      if (avatarFile) {
          avatarUrl = await minioService.uploadFile(avatarFile);
      }

      const pending = await userService.getRegistrationCode(email);
      
      if (pending) {
        await userService.saveRegistrationCode(
          email,
          username,
          hashedPassword,
          avatarUrl,
          code
        );
        
        // Отправляем письмо (раскомментировано)
        await emailService.sendVerificationEmail(email, code);

        res.json({
          message: "Код подтверждения отправлен повторно на email",
        });
        return;
      }

      await userService.saveRegistrationCode(
        email,
        username,
        hashedPassword,
        avatarUrl,
        code
      );

      // Отправляем письмо (раскомментировано)
      await emailService.sendVerificationEmail(email, code);

      res.json({ message: "Код подтверждения отправлен на email" });
    } catch (e: any) {
      console.error("!!! ОШИБКА В PRE-REGISTER:", e.message, e.stack);
      next(e);
    }
  }

  async confirmRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code } = req.body;
      const tempData = await userService.getRegistrationCode(email);

      if (!tempData) {
        const err = new Error("Нет запроса на регистрацию для этого email") as CustomError;
        err.status = 400;
        return next(err);
      }

      // ПРОВЕРКА КОДА (Была пропущена в твоем файле)
      if (String(tempData.code).trim() !== String(code).trim()) {
          const err = new Error("Неверный код подтверждения") as CustomError;
          err.status = 400;
          return next(err);
      }

      const role = await roleService.findRoleByValue("USER");
      if (!role) {
        const err = new Error("Роль 'USER' не найдена в базе данных") as CustomError;
        err.status = 500;
        return next(err);
      }

      const newUser = await userService.createUser(
        tempData.username,
        tempData.password, 
        role.id,
        tempData.avatar_url,
        tempData.email
      );

      await userService.deleteRegistrationCode(email);

      const accessToken = generateAccessToken(newUser.id, role.value);
      const refreshToken = generateRefreshToken(newUser.id, role.value);

      res.json({
        message: "Регистрация прошла успешно",
        accessToken,
        refreshToken,
        user: {
          id: newUser.id,
          username: newUser.username,
          avatar_url: newUser.avatar_url,
          role: role.value,
        },
      });
    } catch (e: any) {
      console.error("!!! ОШИБКА В CONFIRM-REGISTRATION:", e.message, e.stack);
      next(e);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body;
      const user = await userService.findUserByUsername(username);
      if (!user) {
        const err = new Error("Пользователь с таким именем не найден") as CustomError;
        err.status = 400;
        return next(err);
      }

      if (!user.password) {
        const err = new Error("Ошибка данных пользователя (отсутствует пароль)") as CustomError;
        err.status = 500;
        return next(err);
      }

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        const err = new Error("Введен неверный пароль") as CustomError;
        err.status = 400;
        return next(err);
      }

      let roleValue = "USER";
      if (user.role_id) {
        const role = await roleService.findRoleById(user.role_id);
        if (role) {
            roleValue = role.value;
        }
      }

      const accessToken = generateAccessToken(user.id, roleValue);
      const refreshToken = generateRefreshToken(user.id, roleValue);

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
          role: roleValue,
        },
      });
    } catch (e: any) {
      console.error("!!! ОШИБКА В LOGIN:", e.message, e.stack);
      next(e);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        const err = new Error("Refresh токен не предоставлен") as CustomError;
        err.status = 401;
        return next(err);
      }

      const userData = jwt.verify(refreshToken, secret) as TokenPayload;
      
      const newAccessToken = generateAccessToken(userData.id, userData.role);
      const newRefreshToken = generateRefreshToken(userData.id, userData.role);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (e: any) {
      console.error("!!! ОШИБКА В REFRESH:", e.message, e.stack);
      const err = new Error("Refresh токен недействителен или истёк") as CustomError;
      err.status = 403;
      next(err);
    }
  }

  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (e: any) {
      console.error("!!! ОШИБКА В GETUSERS:", e.message, e.stack);
      next(e);
    }
  }
}

export default new AuthController();