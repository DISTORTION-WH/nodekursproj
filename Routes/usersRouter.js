const Router = require("express");
const router = new Router();
const authMiddleware = require("../middleware/authMiddleware");
const userController = require("../Controllers/userController");
const userService = require("../Services/userService");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/avatars/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const search = req.query.search || "";
    const userId = req.user.id;

    const result = await userService.getAllUsers();
    const filtered = result.filter(
      (u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) &&
        u.id !== userId
    );
    res.json(filtered);
  } catch (e) {
    console.error("❗️ Ошибка в GET /users (поиск):", e.message, e.stack);
    next(e);
  }
});

router.get("/me", authMiddleware, (req, res, next) => {
  try {
    userController.getProfile(req, res, next);
  } catch (e) {
    console.error("❗️ Синхронная ошибка в GET /me:", e.message, e.stack);
    next(e);
  }
});

router.put(
  "/avatar",
  authMiddleware,
  upload.single("avatar"),
  (req, res, next) => {
    try {
      userController.updateAvatar(req, res, next);
    } catch (e) {
      console.error("❗️ Синхронная ошибка в PUT /avatar:", e.message, e.stack);
      next(e);
    }
  }
);

router.put("/password", authMiddleware, (req, res, next) => {
  try {
    userController.changePassword(req, res, next);
  } catch (e) {
    console.error("❗️ Синхронная ошибка в PUT /password:", e.message, e.stack);
    next(e);
  }
});

router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      const err = new Error("Неверный ID пользователя");
      err.status = 400;
      throw err;
    }

    const user = await userService.getUserById(userId);
    if (!user) {
      const err = new Error("Пользователь не найден");
      err.status = 404;
      throw err;
    }
    res.json(user);
  } catch (err) {
    console.error(
      `❗️ Ошибка в GET /users/${req.params.id}:`,
      err.message,
      err.stack
    );
    next(err);
  }
});

module.exports = router;
