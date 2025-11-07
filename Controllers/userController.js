const userService = require("../Services/userService");

class UserController {
  async updateAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Файл не загружен" });
      }
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const updatedUser = await userService.updateUserAvatar(
        req.user.id,
        avatarUrl
      );
      return res.json({
        message: "Аватар обновлён",
        avatarUrl,
        user: updatedUser,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  }
  async getProfile(req, res) {
    try {
      const user = await userService.getUserById(req.user.id);
      if (!user)
        return res.status(404).json({ message: "Пользователь не найден" });
      res.json(user);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  }

  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "oldPassword и newPassword обязательны" });
      }
      await userService.changeUserPassword(
        req.user.id,
        oldPassword,
        newPassword
      );
      res.json({ message: "Пароль изменён" });
    } catch (e) {
      console.error(e);
      res.status(400).json({ message: e.message || "Ошибка при смене пароля" });
    }
  }
}

module.exports = new UserController();
