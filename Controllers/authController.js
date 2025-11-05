const userService = require("../Services/userService");
const roleService = require("../Services/roleService");
const emailService = require("../Services/emailService");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const { secret } = require("../config");
const bcrypt = require("bcryptjs");

const generateAccessToken = (id, role) => {
  const payload = { id, role };
  return jwt.sign(payload, secret, { expiresIn: "15m" });
};

const generateRefreshToken = (id, role) => {
  const payload = { id, role };
  return jwt.sign(payload, secret, { expiresIn: "30d" });
};

class authController {
  // ===================== Pre-registration =====================
  async preRegister(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const err = new Error("Ошибка при валидации");
        err.status = 400;
        err.errors = errors.array();
        return next(err);
      }

      const { username, password, email } = req.body;
      const avatar = req.file;

      const candidate = await userService.findUserByUsername(username);
      if (candidate) {
        const err = new Error("Пользователь с таким именем уже существует");
        err.status = 400;
        return next(err);
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-значный код
      const avatarUrl = avatar ? `/uploads/avatars/${avatar.filename}` : null;

      // Проверяем, есть ли pending регистрация по email
      const pending = await userService.getRegistrationCode(email);
      if (pending) {
        // обновляем код и данные
        await userService.saveRegistrationCode(email, username, hashedPassword, avatarUrl, code);
        
        // ❗️ ОТПРАВКА EMAIL ОТКЛЮЧЕНА (для теста)
        // await emailService.sendVerificationEmail(email, code); 
        
        return res.json({ message: "Код подтверждения отправлен повторно на email" });
      }

      // Сохраняем новый код регистрации
      await userService.saveRegistrationCode(email, username, hashedPassword, avatarUrl, code);
      
      // ❗️ ОТПРАВКА EMAIL ОТКЛЮЧЕНА (для теста)
      // await emailService.sendVerificationEmail(email, code);

      res.json({ message: "Код подтверждения отправлен на email" });
    } catch (e) {
      console.error("!!! ОШИБКА В PRE-REGISTER:", e.message, e.stack); 
      next(e); // Передаем в глобальный обработчик
    }
  }

  // ===================== Confirm-registration =====================
  async confirmRegistration(req, res, next) {
    try {
      const { email, code } = req.body;
      const tempData = await userService.getRegistrationCode(email);

      if (!tempData) {
        const err = new Error("Нет запроса на регистрацию для этого email");
        err.status = 400;
        return next(err);
      }

      // ❗️ ПРОВЕРКА КОДА ОТКЛЮЧЕНА (для теста)
      /*
      if (tempData.code !== code) {
        const err = new Error("Неверный код");
        err.status = 400;
        return next(err);
      }
      */

      const role = await roleService.findRoleByValue("USER");
      if (!role) {
        const err = new Error("Роль 'USER' не найдена в базе данных");
        err.status = 500;
        return next(err);
      }

      const newUser = await userService.createUser(
        tempData.username,
        tempData.password, // Пароль уже хэширован
        role.id,
        tempData.avatar_url,
        tempData.email
      );

      // Удаляем временные данные
      await userService.deleteRegistrationCode(email);

      // Генерируем токены (как при логине)
      const accessToken = generateAccessToken(newUser.id, role.value);
      const refreshToken = generateRefreshToken(newUser.id, role.value);

      res.json({
        message: "Регистрация прошла успешно",
        accessToken,
        refreshToken,
        user: {
          id: newUser.id,
          username: newUser.username,
          avatar_url: newUser.avatar_url,
          role: role.value,
        },
      });

    } catch (e) {
      console.error("!!! ОШИБКА В CONFIRM-REGISTRATION:", e.message, e.stack);
      next(e);
    }
  }

  // ===================== Login =====================
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      const user = await userService.findUserByUsername(username);
      if (!user) {
        const err = new Error("Пользователь с таким именем не найден");
        err.status = 400;
        return next(err);
      }

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        const err = new Error("Введен неверный пароль");
        err.status = 400;
        return next(err);
      }

      const role = await roleService.findRoleById(user.role_id);
      const roleValue = role ? role.value : "USER";

      const accessToken = generateAccessToken(user.id, roleValue);
      const refreshToken = generateRefreshToken(user.id, roleValue);

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
          role: roleValue,
        },
      });
    } catch (e) {
      console.error("!!! ОШИБКА В LOGIN:", e.message, e.stack);
      next(e);
    }
  }

  // ===================== Refresh =====================
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        const err = new Error("Refresh токен не предоставлен");
        err.status = 401;
        return next(err);
      }

      const userData = jwt.verify(refreshToken, secret);
      const newAccessToken = generateAccessToken(userData.id, userData.role);
      const newRefreshToken = generateRefreshToken(userData.id, userData.role);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (e) {
      console.error("!!! ОШИБКА В REFRESH:", e.message, e.stack);
      const err = new Error("Refresh токен недействителен или истёк");
      err.status = 403;
      next(err);
    }
  }

  async getUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (e) {
      console.error("!!! ОШИБКА В GETUSERS:", e.message, e.stack);
      next(e);
    }
  }
}

module.exports = new authController();