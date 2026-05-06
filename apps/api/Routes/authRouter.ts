import { Router, Request, Response, NextFunction } from "express";
import { body } from "express-validator";
import multer, { MulterError } from "multer";
import rateLimit from "express-rate-limit";
import authController from "../Controllers/authController";
import authMiddleware from "../middleware/authMiddleware";
import roleMiddleware from "../middleware/roleMiddleware";

const router = Router();

// ─── Rate limiters ───────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много попыток входа. Попробуйте через 15 минут." },
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много запросов на регистрацию. Попробуйте через час." },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много запросов на сброс пароля. Попробуйте через 15 минут." },
});

// ─── Multer с проверкой MIME-типа ────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Допустимые форматы: JPEG, PNG, GIF, WEBP"));
    }
  },
});

interface AppError extends Error {
  status?: number;
}

const handleUploadErrors = (
  err: AppError | MulterError | undefined,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof MulterError) {
    console.warn("❗️ Ошибка Multer (загрузка аватара):", err.message);
    const error: AppError = new Error(`Ошибка загрузки файла: ${err.message}`);
    error.status = 400;
    return next(error);
  } else if (err) {
    console.error("❗️ Ошибка при загрузке файла:", err.message);
    const error: AppError = new Error(err.message);
    error.status = 400;
    return next(error);
  }
  next();
};

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post(
  "/pre-registration",
  registrationLimiter,
  upload.single("avatar"),
  handleUploadErrors,
  [
    body("username", "Имя пользователя не может быть пустым")
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 32 })
      .withMessage("Имя пользователя должно быть от 2 до 32 символов"),
    body("password", "Пароль должен быть от 8 до 64 символов")
      .isLength({ min: 8, max: 64 })
      .matches(/[A-Za-zА-Яа-я]/)
      .withMessage("Пароль должен содержать хотя бы одну букву")
      .matches(/\d/)
      .withMessage("Пароль должен содержать хотя бы одну цифру"),
    body("email", "Неверный email").isEmail().normalizeEmail(),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authController.preRegister(req, res, next);
    } catch (e: unknown) {
      const err = e as AppError;
      console.error("❗️ Ошибка в POST /auth/pre-registration:", err.message);
      next(e);
    }
  }
);

router.post(
  "/confirm-registration",
  registrationLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authController.confirmRegistration(req, res, next);
    } catch (e: unknown) {
      const err = e as AppError;
      console.error("❗️ Ошибка в POST /auth/confirm-registration:", err.message);
      next(e);
    }
  }
);

router.post(
  "/login",
  loginLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authController.login(req, res, next);
    } catch (e: unknown) {
      const err = e as AppError;
      console.error("❗️ Ошибка в POST /auth/login:", err.message);
      next(e);
    }
  }
);

router.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authController.refresh(req, res, next);
    } catch (e: unknown) {
      const err = e as AppError;
      console.error("❗️ Ошибка в POST /auth/refresh:", err.message);
      next(e);
    }
  }
);

router.get(
  "/users",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authController.getUsers(req, res, next);
    } catch (e: unknown) {
      const err = e as AppError;
      console.error("❗️ Ошибка в GET /auth/users:", err.message);
      next(e);
    }
  }
);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authController.forgotPassword(req, res, next);
    } catch (e: unknown) {
      next(e);
    }
  }
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authController.resetPassword(req, res, next);
    } catch (e: unknown) {
      next(e);
    }
  }
);

export default router;
