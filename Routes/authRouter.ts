import { Router, Request, Response, NextFunction } from "express";
// Используем 'body' вместо 'check' для POST запросов
import { body } from "express-validator"; 
import multer, { MulterError } from "multer";
import authController from "../Controllers/authController";

const router = Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/avatars/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Middleware для обработки ошибок Multer
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

router.post(
  "/pre-registration",
  upload.single("avatar"),
  handleUploadErrors,
  [
    // Заменили check на body
    body("username", "Имя пользователя не может быть пустым").notEmpty(),
    body(
      "password",
      "Пароль должен быть больше 4 и меньше 10 символов"
    ).isLength({ min: 4, max: 10 }),
    body("email", "Неверный email").isEmail(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authController.preRegister(req, res, next);
    } catch (e: any) {
      console.error(
        "❗️ Ошибка в POST /auth/pre-registration:",
        e.message,
        e.stack
      );
      next(e);
    }
  }
);

router.post("/confirm-registration", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authController.confirmRegistration(req, res, next);
  } catch (e: any) {
    console.error(
      "❗️ Ошибка в POST /auth/confirm-registration:",
      e.message,
      e.stack
    );
    next(e);
  }
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authController.login(req, res, next);
  } catch (e: any) {
    console.error("❗️ Ошибка в POST /auth/login:", e.message, e.stack);
    next(e);
  }
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authController.refresh(req, res, next);
  } catch (e: any) {
    console.error("❗️ Ошибка в POST /auth/refresh:", e.message, e.stack);
    next(e);
  }
});

router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authController.getUsers(req, res, next);
  } catch (e: any) {
    console.error("❗️ Ошибка в GET /auth/users:", e.message, e.stack);
    next(e);
  }
});

export default router;