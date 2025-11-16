const client = require("../databasepg");
const chatService = require("./chatService");

class AdminService {
  async getAppStats() {
    try {
      const [usersRes, chatsRes, messagesRes, logsRes] = await Promise.all([
        client.query("SELECT COUNT(*) FROM users"),
        client.query("SELECT COUNT(*) FROM chats"),
        client.query("SELECT COUNT(*) FROM messages"),
        client.query("SELECT COUNT(*) FROM app_logs WHERE level = 'ERROR'"),
      ]);

      return {
        usersCount: parseInt(usersRes.rows[0].count, 10),
        chatsCount: parseInt(chatsRes.rows[0].count, 10),
        messagesCount: parseInt(messagesRes.rows[0].count, 10),
        logsCount: parseInt(logsRes.rows[0].count, 10),
      };
    } catch (e) {
      console.error(`[AdminService] Ошибка getAppStats:`, e.message, e.stack);
      throw e;
    }
  }

  async deleteChat(chatId) {
    await chatService.deleteChatAndData(chatId);
  }
}

module.exports = new AdminService();
