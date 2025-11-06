const userService = require("../Services/userService");
const client = require("../databasepg");
const logService = require("../Services/logService"); // 👈 ДОБАВЛЕНО

class AdminController {
  // Получение всех пользователей
  async getAllUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (e) {
      next(e);
    }
  }

  // Обновление пользователя
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { username, roleId, email } = req.body;
      const updated = await userService.updateUser(id, { username, roleId, email });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }

  // Удаление пользователя
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.json({ message: "Пользователь удалён" });
    } catch (e) {
      next(e);
    }
  }

  // Поиск пользователей
  async searchUsers(req, res, next) {
    try {
      const { q } = req.query;
      const result = await userService.searchUsers(q);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }

  // Удаление чата
  async deleteChat(req, res, next) {
    try {
      const { id } = req.params;
      await client.query("DELETE FROM chats WHERE id = $1", [id]);
      res.json({ message: "Чат удалён" });
    } catch (e) {
      next(e);
    }
  }

  // Получение всех чатов
  async getAllChats(req, res, next) {
    try {
      // Исправлено: используем chatService для получения полной информации, если нужно, 
      // или оставляем простой запрос, если достаточно базовой информации.
      // Для админки лучше видеть полную картину, но пока оставим как было для простоты,
      // или можно заменить на chatService.getAllChats() если он импортирован.
      const chats = await client.query("SELECT * FROM chats");
      res.json(chats.rows);
    } catch (e) {
      next(e);
    }
  }

  // 🆕 Получение статистики
  async getStats(req, res, next) {
    try {
      const [usersRes, chatsRes, messagesRes, logsRes] = await Promise.all([
        client.query("SELECT COUNT(*) FROM users"),
        client.query("SELECT COUNT(*) FROM chats"),
        client.query("SELECT COUNT(*) FROM messages"),
        client.query("SELECT COUNT(*) FROM app_logs")
      ]);

      res.json({
        usersCount: parseInt(usersRes.rows[0].count, 10),
        chatsCount: parseInt(chatsRes.rows[0].count, 10),
        messagesCount: parseInt(messagesRes.rows[0].count, 10),
        logsCount: parseInt(logsRes.rows[0].count, 10),
      });
    } catch (e) {
      next(e);
    }
  }

  // 🆕 Получение логов
  async getLogs(req, res, next) {
    try {
      const limit = req.query.limit || 100;
      const logs = await logService.getRecentLogs(limit);
      res.json(logs);
    } catch (e) {
      next(e);
    }
  }
}

module.exports = new AdminController();