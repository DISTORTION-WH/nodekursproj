import { Router, Response, NextFunction, Request } from "express";
import multer from "multer";
import authMiddleware, { AuthRequest } from "../middleware/authMiddleware";
import userController from "../Controllers/userController";
import userService from "../Services/userService";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get("/", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string) || "";
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

router.get("/me", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await userController.getProfile(req as Request, res);
  } catch (e: any) {
    console.error("❗️ Ошибка в GET /me:", e.message, e.stack);
    next(e);
  }
});

router.put(
  "/avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await userController.updateAvatar(req as Request, res);
    } catch (e: any) {
      console.error("❗️ Ошибка в PUT /avatar:", e.message, e.stack);
      next(e);
    }
  }
);

router.put("/password", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await userController.changePassword(req as Request, res);
  } catch (e: any) {
    console.error("❗️ Ошибка в PUT /password:", e.message, e.stack);
    next(e);
  }
});

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