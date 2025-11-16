const userService = require("../Services/userService");
const chatService = require("../Services/chatService");
const adminService = require("../Services/adminService");
const logService = require("../Services/logService");

class AdminController {
  async getAllUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (e) {
      next(e);
    }
  }

  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { username, roleId, email } = req.body;
      const updated = await userService.updateUser(id, {
        username,
        roleId,
        email,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.json({ message: "Пользователь удалён" });
    } catch (e) {
      next(e);
    }
  }

  async searchUsers(req, res, next) {
    try {
      const { q } = req.query;
      const result = await userService.searchUsers(q);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }

  async deleteChat(req, res, next) {
    try {
      const { id } = req.params;
      await adminService.deleteChat(id);
      res.json({ message: "Чат и все его данные удалены" });
    } catch (e) {
      next(e);
    }
  }

  async getAllChats(req, res, next) {
    try {
      const chats = await chatService.getAllChats();
      res.json(chats);
    } catch (e) {
      next(e);
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await adminService.getAppStats();
      res.json(stats);
    } catch (e) {
      next(e);
    }
  }

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
