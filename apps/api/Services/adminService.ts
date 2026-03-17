import client from "../databasepg";
import chatService from "./chatService";

export interface AppStats {
  usersCount: number;
  chatsCount: number;
  messagesCount: number;
  logsCount: number;
}

interface CountResult {
  count: string;
}

class AdminService {
  async getAppStats(): Promise<AppStats> {
    try {

      const [usersRes, chatsRes, messagesRes, logsRes] = await Promise.all([
        client.query<CountResult>("SELECT COUNT(*) FROM users"),
        client.query<CountResult>("SELECT COUNT(*) FROM chats"),
        client.query<CountResult>("SELECT COUNT(*) FROM messages"),
        client.query<CountResult>("SELECT COUNT(*) FROM app_logs WHERE level = 'ERROR'"),
      ]);

      return {
        usersCount: parseInt(usersRes.rows[0].count, 10),
        chatsCount: parseInt(chatsRes.rows[0].count, 10),
        messagesCount: parseInt(messagesRes.rows[0].count, 10),
        logsCount: parseInt(logsRes.rows[0].count, 10),
      };
    } catch (e: any) {
      console.error(`[AdminService] Ошибка getAppStats:`, e.message, e.stack);
      throw e;
    }
  }

  async deleteChat(chatId: string | number): Promise<void> {
    await chatService.deleteChatAndData(chatId);
  }
}

export default new AdminService();