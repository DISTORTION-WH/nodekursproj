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

router.patch("/me/status", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const { status } = req.body;
    const allowed = ["online", "away", "dnd", "offline"];
    if (!allowed.includes(status)) {
      res.status(400).json({ message: "Недопустимый статус" });
      return;
    }
    // "offline" from the UI means invisible mode
    const isInvisible = status === "offline";
    const client = require("../databasepg").default;
    await client.query("UPDATE users SET status = $1, is_invisible = $2 WHERE id = $3", [status, isInvisible, userId]);
    // Notify all chats — broadcast "offline" for invisible users
    const io = req.app.get("io");
    io.emit("user_status_changed", { userId, status });
    res.json({ status });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/theme", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const { theme } = req.body;
    const allowed = ["dark", "gray", "light", "discord"];
    if (!allowed.includes(theme)) {
      res.status(400).json({ message: "Недопустимая тема" });
      return;
    }
    await userService.updateUserTheme(userId, theme);
    res.json({ theme });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/frame", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const { frame } = req.body;
    // frame is either a valid frame id string or null (no frame)
    await userService.updateUserAvatarFrame(userId, frame ?? null);
    res.json({ avatar_frame: frame ?? null });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/bio", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const { bio } = req.body;
    const client = require("../databasepg").default;
    await client.query("UPDATE users SET bio = $1 WHERE id = $2", [bio ?? "", userId]);
    res.json({ bio: bio ?? "" });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/country", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const { country } = req.body;
    const client = require("../databasepg").default;
    await client.query("UPDATE users SET country = $1 WHERE id = $2", [country ?? "", userId]);
    res.json({ country: country ?? "" });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/username", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const { username } = req.body as { username?: string };
    if (!username || !username.trim()) {
      res.status(400).json({ message: "Имя пользователя не может быть пустым" });
      return;
    }
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 32) {
      res.status(400).json({ message: "Имя пользователя должно быть от 3 до 32 символов" });
      return;
    }
    const db = require("../databasepg").default;
    // Check uniqueness
    const existing = await db.query("SELECT id FROM users WHERE username = $1 AND id != $2", [trimmed, userId]);
    if (existing.rows.length > 0) {
      res.status(409).json({ message: "Это имя пользователя уже занято" });
      return;
    }
    await db.query("UPDATE users SET username = $1 WHERE id = $2", [trimmed, userId]);
    // Broadcast to all connected sockets
    const io = req.app.get("io");
    io.emit("user_renamed", { userId, username: trimmed });
    res.json({ username: trimmed });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/profile-bg", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const { profile_bg } = req.body;
    await userService.updateProfileBg(userId, profile_bg ?? "");
    res.json({ profile_bg: profile_bg ?? "" });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/username-style", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const { username_color, username_anim } = req.body;
    const allowedAnims = ["", "rainbow", "pulse", "glitch", "shimmer", "fire"];
    if (username_anim !== undefined && !allowedAnims.includes(username_anim)) {
      res.status(400).json({ message: "Недопустимая анимация" });
      return;
    }
    await userService.updateUsernameStyle(userId, username_color ?? "", username_anim ?? "");
    res.json({ username_color: username_color ?? "", username_anim: username_anim ?? "" });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/profile-extras", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const { profile_badge, bubble_color, social_link, accent_color } = req.body;
    await userService.updateProfileExtras(
      userId,
      (profile_badge ?? "").slice(0, 10),
      bubble_color ?? "",
      (social_link ?? "").slice(0, 200),
      accent_color ?? ""
    );
    res.json({ profile_badge, bubble_color, social_link, accent_color });
  } catch (e: any) {
    next(e);
  }
});

router.post("/me/reset-profile", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const db = require("../databasepg").default;
    await db.query(
      `UPDATE users SET
        profile_bg='', username_color='', username_anim='',
        profile_badge='', bubble_color='', social_link='', accent_color='',
        bio='', country=''
       WHERE id=$1`,
      [userId]
    );
    res.json({ ok: true });
  } catch (e: any) {
    next(e);
  }
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id as string, 10);
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
      `❗️ Ошибка в GET /users/${req.params.id as string}:`,
      err.message,
      err.stack
    );
    next(err);
  }
});

export default router;