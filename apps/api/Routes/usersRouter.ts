import { Router, Response, NextFunction, Request } from "express";
import multer from "multer";
import authMiddleware, { AuthRequest } from "../middleware/authMiddleware";
import userController from "../Controllers/userController";
import userService from "../Services/userService";

const router = Router();

const storage = multer.memoryStorage();
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error(`Недопустимый тип аватара: ${file.mimetype}`));
  },
});

const normalizeString = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const isSafeHttpUrl = (value: string): boolean => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

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
    const bio = normalizeString(req.body?.bio, 200);
    const client = require("../databasepg").default;
    await client.query("UPDATE users SET bio = $1 WHERE id = $2", [bio, userId]);
    res.json({ bio });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/country", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const country = normalizeString(req.body?.country, 4).toUpperCase();
    const client = require("../databasepg").default;
    await client.query("UPDATE users SET country = $1 WHERE id = $2", [country, userId]);
    res.json({ country });
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
    const profileBg = normalizeString(req.body?.profile_bg, 500000);
    await userService.updateProfileBg(userId, profileBg);
    res.json({ profile_bg: profileBg });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/username-style", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const usernameColor = normalizeString(req.body?.username_color, 32);
    const usernameAnim = normalizeString(req.body?.username_anim, 30);
    const allowedAnims = ["", "rainbow", "pulse", "glitch", "shimmer", "fire"];
    if (!allowedAnims.includes(usernameAnim)) {
      res.status(400).json({ message: "Недопустимая анимация" });
      return;
    }
    await userService.updateUsernameStyle(userId, usernameColor, usernameAnim);
    res.json({ username_color: usernameColor, username_anim: usernameAnim });
  } catch (e: any) {
    next(e);
  }
});

router.patch("/me/profile-extras", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const profileBadge = normalizeString(req.body?.profile_badge, 10);
    const bubbleColor = normalizeString(req.body?.bubble_color, 64);
    const socialLink = normalizeString(req.body?.social_link, 200);
    const accentColor = normalizeString(req.body?.accent_color, 64);
    if (!isSafeHttpUrl(socialLink)) {
      res.status(400).json({ message: "Недопустимая ссылка" });
      return;
    }
    await userService.updateProfileExtras(
      userId,
      profileBadge,
      bubbleColor,
      socialLink,
      accentColor
    );
    res.json({
      profile_badge: profileBadge,
      bubble_color: bubbleColor,
      social_link: socialLink,
      accent_color: accentColor,
    });
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

router.get("/me/mentions", authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id;
    const db = require("../databasepg").default;
    const result = await db.query(
      `SELECT mm.id, mm.message_id, m.chat_id, mm.seen, mm.created_at,
              m.text, u.username as sender_name, c.name as chat_name
       FROM message_mentions mm
       JOIN messages m ON m.id = mm.message_id
       JOIN users u ON u.id = m.sender_id
       JOIN chats c ON c.id = m.chat_id
       WHERE mm.mentioned_user_id = $1
       ORDER BY mm.created_at DESC LIMIT 50`,
      [userId]
    );
    res.json(result.rows);
  } catch (e: any) { next(e); }
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
