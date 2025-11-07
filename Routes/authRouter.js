const Router = require("express");
const router = new Router();
const controller = require("../Controllers/authController");
const { check } = require("express-validator");
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
const upload = multer({ storage });

const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.warn("❗️ Ошибка Multer (загрузка аватара):", err.message);
    const error = new Error(`Ошибка загрузки файла: ${err.message}`);
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
    check("username", "Имя пользователя не может быть пустым").notEmpty(),
    check(
      "password",
      "Пароль должен быть больше 4 и меньше 10 символов"
    ).isLength({ min: 4, max: 10 }),
    check("email", "Неверный email").isEmail(),
  ],
  async (req, res, next) => {
    try {
      await controller.preRegister(req, res, next);
    } catch (e) {
      console.error(
        "❗️ Ошибка в POST /auth/pre-registration:",
        e.message,
        e.stack
      );
      next(e);
    }
  }
);

router.post("/confirm-registration", async (req, res, next) => {
  try {
    await controller.confirmRegistration(req, res, next);
  } catch (e) {
    console.error(
      "❗️ Ошибка в POST /auth/confirm-registration:",
      e.message,
      e.stack
    );
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    await controller.login(req, res, next);
  } catch (e) {
    console.error("❗️ Ошибка в POST /auth/login:", e.message, e.stack);
    next(e);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    await controller.refresh(req, res, next);
  } catch (e) {
    console.error("❗️ Ошибка в POST /auth/refresh:", e.message, e.stack);
    next(e);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    await controller.getUsers(req, res, next);
  } catch (e) {
    console.error("❗️ Ошибка в GET /auth/users:", e.message, e.stack);
    next(e);
  }
});

module.exports = router;
