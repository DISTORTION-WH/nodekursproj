const Router = require('express');
const router = new Router();
const controller = require('../Controllers/authController');
const { check } = require('express-validator');
const multer = require("multer");

// Настройка multer для загрузки аватарок
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ===================== Новые маршруты =====================
router.post(
  '/pre-registration',
  upload.single("avatar"),
  [
    check('username', 'Имя пользователя не может быть пустым').notEmpty(),
    check('password', 'Пароль должен быть больше 4 и меньше 10 символов').isLength({ min: 4, max: 10 }),
    check('email', 'Неверный email').isEmail()
  ],
  controller.preRegister
);

router.post('/confirm-registration', controller.confirmRegistration);

// ===================== Существующие маршруты =====================
router.post('/login', controller.login);
router.post('/refresh', controller.refresh)
router.get('/users', controller.getUsers);

module.exports = router;
