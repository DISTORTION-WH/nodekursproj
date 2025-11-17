import { Router, Response, NextFunction, Request } from "express";
import multer from "multer";
import authMiddleware, { AuthRequest } from "../middleware/authMiddleware";
import userController from "../Controllers/userController";
import userService from "../Services/userService";

const router = Router();

const storage = multer.diskStorage({
  destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    cb(null, "uploads/avatars/");
  },
  filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Поиск пользователей
router.get("/", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string) || "";
    // Приводим user к any, так как структура user из токена может варьироваться,
    // но мы знаем, что там есть id из authMiddleware
    const userId = (req.user as any).id;

    const result = await userService.getAllUsers();
    const filtered = result.filter(
      (u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) &&
        u.id !== userId
    );
    res.json(filtered);
  } catch (e: any) {
    console.error("❗️ Ошибка в GET /users (поиск):", e.message, e.stack);
    next(e);
  }
});

// Получить свой профиль
router.get("/me", authMiddleware, (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Передаем как Request, так как контроллер ожидает стандартный Request (или расширенный, если он тоже типизирован)
    userController.getProfile(req as Request, res, next);
  } catch (e: any) {
    console.error("❗️ Синхронная ошибка в GET /me:", e.message, e.stack);
    next(e);
  }
});

// Обновить аватар
router.put(
  "/avatar",
  authMiddleware,
  upload.single("avatar"),
  (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      userController.updateAvatar(req as Request, res, next);
    } catch (e: any) {
      console.error("❗️ Синхронная ошибка в PUT /avatar:", e.message, e.stack);
      next(e);
    }
  }
);

// Сменить пароль
router.put("/password", authMiddleware, (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    userController.changePassword(req as Request, res, next);
  } catch (e: any) {
    console.error("❗️ Синхронная ошибка в PUT /password:", e.message, e.stack);
    next(e);
  }
});

// Получить пользователя по ID
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      const err: any = new Error("Неверный ID пользователя");
      err.status = 400;
      throw err;
    }

    const user = await userService.getUserById(userId);
    if (!user) {
      const err: any = new Error("Пользователь не найден");
      err.status = 404;
      throw err;
    }
    res.json(user);
  } catch (err: any) {
    console.error(
      `❗️ Ошибка в GET /users/${req.params.id}:`,
      err.message,
      err.stack
    );
    next(err);
  }
});

export default router;