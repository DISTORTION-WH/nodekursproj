const Router = require("express");
const router = new Router();
const authMiddleware = require("../middleware/authMiddleware");
const userController = require("../Controllers/userController");
const userService = require("../Services/userService");
const multer = require("multer");

// Настройка multer для аватаров
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

// Поиск пользователей (не друзья)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const search = req.query.search || "";
    const userId = req.user.id;

    const result = await userService.getAllUsers();
    // фильтруем по поиску и исключаем текущего пользователя
    const filtered = result.filter(
      u =>
        u.username.toLowerCase().includes(search.toLowerCase()) &&
        u.id !== userId
    );
    res.json(filtered);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Данные текущего пользователя
router.get("/me", authMiddleware, userController.getProfile);

// Смена аватара
router.put("/avatar", authMiddleware, upload.single("avatar"), userController.updateAvatar);

// Смена пароля
router.put("/password", authMiddleware, userController.changePassword);

// Получение профиля пользователя по id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = await userService.getUserById(userId);
    if (!user) return res.status(404).json({ message: "Пользователь не найден" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ошибка сервера при получении профиля" });
  }
});

module.exports = router;
