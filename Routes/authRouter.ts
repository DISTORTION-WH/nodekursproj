<<<<<<< HEAD
import { Router, Request, Response, NextFunction } from "express";
import { body } from "express-validator"; 
import multer, { MulterError } from "multer";
import authController from "../Controllers/authController";
=======
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { secret } from '../config';
import userService from "../Services/userService";
import roleService from "../Services/roleService";
import emailService from "../Services/emailService";
import minioService from "../Services/minioService";
>>>>>>> 48554d2fe43e17b5bc063b9694e36cb7cf4de2b6

const router = Router();

// Используем память для быстрой передачи в MinIO/R2
const storage = multer.memoryStorage();
const upload = multer({ storage });

const handleUploadErrors = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof MulterError) {
    console.warn("❗️ Ошибка Multer (загрузка аватара):", err.message);
    const error: any = new Error(`Ошибка загрузки файла: ${err.message}`);
    error.status = 400;
    return next(error);
  } else if (err) {
    console.error("❗️ Ошибка I/O при загрузке файла:", err.message, err.stack);
    return next(err);
  }

  next();
};

// --- МАРШРУТЫ ---

router.post(
  "/pre-registration",
  upload.single("avatar"),
  handleUploadErrors,
  [
    body("username", "Имя пользователя не может быть пустым").notEmpty(),
    body("password", "Пароль должен быть 4-10 символов").isLength({ min: 4, max: 10 }),
    body("email", "Неверный email").isEmail(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
<<<<<<< HEAD
      await authController.preRegister(req, res, next);
=======
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

      await emailService.sendVerificationEmail(email, code);

      res.json({ message: "Код подтверждения отправлен на email" });
>>>>>>> 48554d2fe43e17b5bc063b9694e36cb7cf4de2b6
    } catch (e: any) {
      console.error("❗️ Ошибка в POST /auth/pre-registration:", e.message);
      next(e);
    }
  }
);

<<<<<<< HEAD
router.post("/confirm-registration", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authController.confirmRegistration(req, res, next);
  } catch (e: any) {
    console.error("❗️ Ошибка в POST /auth/confirm-registration:", e.message);
    next(e);
=======
  async confirmRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code } = req.body;
      const tempData = await userService.getRegistrationCode(email);

      if (!tempData) {
        const err = new Error("Нет запроса на регистрацию для этого email") as CustomError;
        err.status = 400;
        return next(err);
      }

      // Проверка кода
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
>>>>>>> 48554d2fe43e17b5bc063b9694e36cb7cf4de2b6
  }
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authController.login(req, res, next);
  } catch (e: any) {
    console.error("❗️ Ошибка в POST /auth/login:", e.message);
    next(e);
  }
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authController.refresh(req, res, next);
  } catch (e: any) {
    console.error("❗️ Ошибка в POST /auth/refresh:", e.message);
    next(e);
  }
});

router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authController.getUsers(req, res, next);
  } catch (e: any) {
    console.error("❗️ Ошибка в GET /auth/users:", e.message);
    next(e);
  }
});

export default router;