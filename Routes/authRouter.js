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


// --- ❗️ НОВЫЙ ОБРАБОТЧИК ОШИБОК MULTER ---
// Этот middleware будет ловить ошибки, которые кидает upload.single()
// (например, если файл слишком большой или неверного типа)
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Ошибка, связанная с Multer
    console.warn('❗️ Ошибка Multer (загрузка аватара):', err.message);
    // Создаем ошибку 400 (Bad Request)
    const error = new Error(`Ошибка загрузки файла: ${err.message}`);
    error.status = 400;
    return next(error);
  } else if (err) {
    // Другая непредвиденная ошибка (например, ошибка доступа к ФС)
    console.error('❗️ Ошибка I/O при загрузке файла:', err.message, err.stack);
    return next(err); // Передаем в глобальный обработчик
  }
  
  // Если ошибок нет, продолжаем
  next();
};

// ===================== Новые маршруты =====================

// ❗️ ИЗМЕНЕНО: Добавлен handleUploadErrors и обертка async (req, res, next)
router.post(
  '/pre-registration',
  upload.single("avatar"),
  handleUploadErrors, // 1. Ловим ошибки Multer
  [ // 2. Валидируем
    check('username', 'Имя пользователя не может быть пустым').notEmpty(),
    check('password', 'Пароль должен быть больше 4 и меньше 10 символов').isLength({ min: 4, max: 10 }),
    check('email', 'Неверный email').isEmail()
  ],
  // 3. Оборачиваем вызов контроллера для перехвата его ошибок
  async (req, res, next) => {
    try {
      // Контроллер сам проверит ошибки валидации и выполнит логику
      await controller.preRegister(req, res, next);
    } catch (e) {
      console.error("❗️ Ошибка в POST /auth/pre-registration:", e.message, e.stack);
      next(e); // Передаем ошибку в глобальный обработчик
    }
  }
);

// ❗️ ИЗМЕНЕНО: Добавлена обертка async (req, res, next)
router.post('/confirm-registration', async (req, res, next) => {
    try {
      await controller.confirmRegistration(req, res, next);
    } catch(e) {
      console.error("❗️ Ошибка в POST /auth/confirm-registration:", e.message, e.stack);
      next(e);
    }
});

// ===================== Существующие маршруты =====================

// ❗️ ИЗМЕНЕНО: Добавлена обертка async (req, res, next)
router.post('/login', async (req, res, next) => {
    try {
      await controller.login(req, res, next);
    } catch(e) {
      console.error("❗️ Ошибка в POST /auth/login:", e.message, e.stack);
      next(e);
    }
});

// ❗️ ИЗМЕНЕНО: Добавлена обертка async (req, res, next)
router.post('/refresh', async (req, res, next) => {
    try {
      await controller.refresh(req, res, next);
    } catch(e) {
      console.error("❗️ Ошибка в POST /auth/refresh:", e.message, e.stack);
      next(e);
    }
});

// ❗️ ИЗМЕНЕНО: Добавлена обертка async (req, res, next)
router.get('/users', async (req, res, next) => {
    try {
      await controller.getUsers(req, res, next);
    } catch(e) {
      console.error("❗️ Ошибка в GET /auth/users:", e.message, e.stack);
      next(e);
    }
});

module.exports = router;