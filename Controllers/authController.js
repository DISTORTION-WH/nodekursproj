const userService = require("../Services/userService");
const roleService = require("../Services/roleService");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { secret } = require("../config");
const emailService = require("../Services/emailService");

class authController {
  // ===================== Pre-registration =====================
  async preRegister(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Ошибка при регистрации", errors });
      }

      const { username, password, email } = req.body;

      // Проверяем username в основной таблице users
      const candidate = await userService.findUserByUsername(username);
      if (candidate) {
        return res.status(400).json({ message: "Пользователь с таким именем уже есть" });
      }

      // Генерация кода подтверждения
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Хэшируем пароль перед временным хранением
      const hashedPassword = await bcrypt.hash(password, 10);

      let avatarUrl = null;
      if (req.file) avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Проверяем, есть ли pending регистрация по email
      const pending = await userService.getRegistrationCode(email);
      if (pending) {
        // обновляем код и данные
        await userService.saveRegistrationCode(email, username, hashedPassword, avatarUrl, code);
        await emailService.sendVerificationEmail(email, code);
        return res.json({ message: "Код подтверждения отправлен повторно на email" });
      }

      // Сохраняем новый код регистрации
      await userService.saveRegistrationCode(email, username, hashedPassword, avatarUrl, code);
      await emailService.sendVerificationEmail(email, code);

      res.json({ message: "Код подтверждения отправлен на email" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  // ===================== Confirm-registration =====================
  async confirmRegistration(req, res) {
    try {
      const { email, code } = req.body;
      const tempData = await userService.getRegistrationCode(email);

      if (!tempData) {
        return res.status(400).json({ message: "Нет запроса на регистрацию для этого email" });
      }

      if (tempData.code !== code) {
        return res.status(400).json({ message: "Неверный код" });
      }

          const role = await roleService.findRoleByValue("USER");

      // Передаём email при создании пользователя
      await userService.createUser(tempData.username, tempData.password, role.id, tempData.avatar_url, tempData.email);

      await userService.deleteRegistrationCode(tempData.email);


      res.json({ message: "Регистрация успешно подтверждена" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  // ===================== Существующие методы =====================
  async login(req, res) {
  try {
    const { username, password } = req.body;
    const user = await userService.findUserByUsername(username);
    if (!user) {
      return res.status(400).json({ message: "Пользователь не найден" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ message: "Неверный пароль" });
    }

    const role = await roleService.findRoleById(user.role_id);

    // короткоживущий access
    const accessToken = jwt.sign(
      { id: user.id, role: role.value },
      secret,
      { expiresIn: "15m" }
    );

    // долгоживущий refresh для перелогирования после истечения jwt
    const refreshToken = jwt.sign(
      { id: user.id, role: role.value },
      secret,
      { expiresIn: "7d" }
    );

    return res.json({ accessToken, refreshToken });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
}


  async getUsers(req, res) {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }

  // ===================== Refresh-token =====================
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(401).json({ message: "Токен обновления отсутствует" });
      }

      // Проверка refresh токена
      jwt.verify(refreshToken, secret, (err, userData) => {
        if (err) {
          return res.status(403).json({ message: "Refresh токен недействителен или истёк" });
        }

        // Генерация нового access токена
        const accessToken = jwt.sign(
          { id: userData.id, role: userData.role },
          secret,
          { expiresIn: "15m" } // короткоживущий access
        );

        return res.json({ accessToken });
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Ошибка сервера при обновлении токена" });
    }
  }
}

module.exports = new authController();
