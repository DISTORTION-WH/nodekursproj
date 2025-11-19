import { Router, Request, Response, NextFunction } from "express";
import { body } from "express-validator"; 
import multer, { MulterError } from "multer";
import authController from "../Controllers/authController";

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
      await authController.preRegister(req, res, next);
    } catch (e: any) {
      console.error("❗️ Ошибка в POST /auth/pre-registration:", e.message);
      next(e);
    }
  }
);

router.post("/confirm-registration", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authController.confirmRegistration(req, res, next);
  } catch (e: any) {
    console.error("❗️ Ошибка в POST /auth/confirm-registration:", e.message);
    next(e);
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