const userService = require("../Services/userService");
const client = require("../databasepg");

class AdminController {
  // Получение всех пользователей
  async getAllUsers(req, res) {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка при получении пользователей" });
    }
  }

  // Обновление пользователя
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { username, roleId, email } = req.body;
      const updated = await userService.updateUser(id, { username, roleId, email });
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка при обновлении пользователя" });
    }
  }

  // Удаление пользователя
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.json({ message: "Пользователь удалён" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка при удалении пользователя" });
    }
  }

  // Поиск пользователей
  async searchUsers(req, res) {
    try {
      const { q } = req.query;
      const result = await userService.searchUsers(q);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка при поиске пользователей" });
    }
  }

  // Удаление чата
  async deleteChat(req, res) {
    try {
      const { id } = req.params;
      await client.query("DELETE FROM chats WHERE id = $1", [id]);
      res.json({ message: "Чат удалён" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка при удалении чата" });
    }
  }

  // Получение всех чатов
  async getAllChats(req, res) {
    try {
      const chats = await client.query("SELECT * FROM chats");
      res.json(chats.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Ошибка при получении чатов" });
    }
  }
}

module.exports = new AdminController();
