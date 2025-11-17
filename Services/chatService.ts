import client from "../databasepg";
import crypto from "crypto";
import { QueryResult } from "pg";


export interface ChatParticipant {
  id: number;
  username: string;
  avatar_url?: string | null;
  invited_by_user_id?: number;
}

export interface Message {
  id: number;
  text: string;
  created_at: Date;
  chat_id: number;
  sender_id: number;
  sender?: { id: number; username: string };
  sender_name?: string;
}

export interface Chat {
  id: number;
  name: string | null;
  is_group: boolean;
  creator_id?: number | null;
  invite_code?: string | null;
  participants?: ChatParticipant[];
  messages?: Message[];
}


class ChatService {
  async getAllChats(): Promise<Chat[]> {
    try {
      const chatsRes: QueryResult<Chat> = await client.query(`
        SELECT c.id, c.name, c.is_group,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', u.id,
                'username', u.username
              )
            ) FILTER (WHERE u.id IS NOT NULL),
            '[]'
          ) AS participants
        FROM chats c
        LEFT JOIN chat_users cu ON cu.chat_id = c.id
        LEFT JOIN users u ON u.id = cu.user_id
        GROUP BY c.id
        ORDER BY c.id
      `);

      const chats = chatsRes.rows;

      for (let chat of chats) {
        const messagesRes: QueryResult<Message> = await client.query(
          `SELECT m.id, m.text, m.created_at,
                  json_build_object('id', u.id, 'username', u.username) as sender
           FROM messages m
           JOIN users u ON u.id = m.sender_id
           WHERE m.chat_id = $1
           ORDER BY m.created_at ASC`,
          [chat.id]
        );
        chat.messages = messagesRes.rows;
      }

      return chats;
    } catch (err: any) {
      console.error(`[ChatService] Ошибка getAllChats:`, err.message, err.stack);
      throw err;
    }
  }

  async deleteMessagesByChat(chatId: string | number): Promise<QueryResult> {
    try {
      return await client.query(`DELETE FROM messages WHERE chat_id = $1`, [
        chatId,
      ]);
    } catch (err: any) {
      console.error(
        `[ChatService] Ошибка deleteMessagesByChat (${chatId}):`,
        err.message,
        err.stack
      );
      throw err;
    }
  }

  async deleteChatUsers(chatId: string | number): Promise<QueryResult> {
    try {
      return await client.query(`DELETE FROM chat_users WHERE chat_id = $1`, [
        chatId,
      ]);
    } catch (err: any) {
      console.error(
        `[ChatService] Ошибка deleteChatUsers (${chatId}):`,
        err.message,
        err.stack
      );
      throw err;
    }
  }

  async deleteChat(chatId: string | number): Promise<QueryResult> {
    try {
      return await client.query(`DELETE FROM chats WHERE id = $1`, [chatId]);
    } catch (err: any) {
      console.error(
        `[ChatService] Ошибка deleteChat (${chatId}):`,
        err.message,
        err.stack
      );
      throw err;
    }
  }

  async deleteChatAndData(chatId: string | number): Promise<void> {
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM messages WHERE chat_id = $1", [chatId]);
      await client.query("DELETE FROM chat_users WHERE chat_id = $1", [
        chatId,
      ]);
      await client.query("DELETE FROM chats WHERE id = $1", [chatId]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(
        `[ChatService] Ошибка в транзакции deleteChatAndData (${chatId}):`,
        e
      );
      throw e;
    }
  }

  async getChatUsers(chatId: string | number, requesterId: string | number): Promise<ChatParticipant[]> {
    const check = await client.query(
      `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, requesterId]
    );
    
    if (check.rows.length === 0) {
      const err: any = new Error("Нет доступа к этому чату");
      err.status = 403;
      throw err;
    }

    const resDb = await client.query<ChatParticipant>(
      `SELECT u.id, u.username, u.avatar_url, cu.invited_by_user_id
       FROM users u JOIN chat_users cu ON u.id = cu.user_id WHERE cu.chat_id = $1`,
      [chatId]
    );
    return resDb.rows;
  }

  async createInviteCode(chatId: string | number): Promise<string> {
    const chatRes = await client.query<Chat>(`SELECT * FROM chats WHERE id = $1`, [chatId]);
    const chat = chatRes.rows[0];
    
    if (!chat) {
      const err: any = new Error("Чат не найден");
      err.status = 404;
      throw err;
    }
    if (!chat.is_group) {
      const err: any = new Error("Приглашать можно только в группы");
      err.status = 400;
      throw err;
    }

    if (chat.invite_code) return chat.invite_code;

    const code = crypto.randomBytes(4).toString("hex");
    await client.query(`UPDATE chats SET invite_code = $1 WHERE id = $2`, [
      code,
      chatId,
    ]);
    return code;
  }

  async joinWithInviteCode(inviteCode: string, userId: string | number): Promise<Chat> {
    const chatRes = await client.query<Chat>(
      `SELECT * FROM chats WHERE invite_code = $1`,
      [inviteCode]
    );
    if (chatRes.rows.length === 0) {
      const err: any = new Error("Неверный код приглашения");
      err.status = 404;
      throw err;
    }
    const chat = chatRes.rows[0];

    const check = await client.query(
      `SELECT 1 FROM chat_users WHERE chat_id=$1 AND user_id=$2`,
      [chat.id, userId]
    );
    if (check.rows.length > 0) {
      const err: any = new Error("Вы уже состоите в этом чате");
      err.status = 400;
      throw err;
    }

    await client.query(
      `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`,
      [chat.id, userId, chat.creator_id]
    );
    return chat;
  }

  async createGroupChat(name: string, creatorId: string | number): Promise<Chat> {
    const newChatRes = await client.query<Chat>(
      `INSERT INTO chats (name, is_group, creator_id) VALUES ($1, true, $2) RETURNING *`,
      [name, creatorId]
    );
    const newChat = newChatRes.rows[0];

    await client.query(
      `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $2)`,
      [newChat.id, creatorId]
    );
    return newChat;
  }

  async inviteToGroup(chatId: string | number, friendId: string | number, inviterId: string | number): Promise<void> {
    await client.query(
      `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`,
      [chatId, friendId, inviterId]
    );
  }

  async kickFromGroup(chatId: string | number, userIdToKick: string | number): Promise<void> {
    await client.query(`DELETE FROM chat_users WHERE chat_id=$1 AND user_id=$2`, [
      chatId,
      userIdToKick,
    ]);
  }

  async getAllUserChats(userId: string | number): Promise<Chat[]> {
    const result = await client.query<Chat>(
      `SELECT c.id, c.name, c.is_group, c.creator_id FROM chats c
       JOIN chat_users cu ON cu.chat_id = c.id WHERE cu.user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  async getChatMessages(chatId: string | number, userId: string | number): Promise<Message[]> {
    const result = await client.query<Message>(
      `SELECT m.id, m.text, m.created_at, m.chat_id, u.id as sender_id, u.username as sender_name
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.chat_id = $1 AND NOT m.deleted_for @> ARRAY[$2]::int[]
       ORDER BY m.created_at ASC`,
      [chatId, userId]
    );
    return result.rows;
  }

  async postMessage(chatId: string | number, senderId: string | number, text: string): Promise<Message> {
    const result = await client.query<Message>(
      `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) 
       RETURNING id, text, created_at, sender_id, chat_id`,
      [chatId, senderId, text]
    );
    return result.rows[0];
  }

  async findOrCreatePrivateChat(userId: string | number, friendId: string | number): Promise<{ id: number }> {
    const exist = await client.query<{ id: number }>(
      `SELECT c.id FROM chats c JOIN chat_users cu1 ON cu1.chat_id = c.id JOIN chat_users cu2 ON cu2.chat_id = c.id
       WHERE c.is_group = false AND cu1.user_id = $1 AND cu2.user_id = $2`,
      [userId, friendId]
    );
    if (exist.rows.length > 0) return exist.rows[0];

    const newChatRes = await client.query<{ id: number }>(
      `INSERT INTO chats (name, is_group, creator_id) VALUES ('', false, $1) RETURNING id`,
      [userId]
    );
    const newChat = newChatRes.rows[0];

    await client.query(
      `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $2), ($1, $3, $2)`,
      [newChat.id, userId, friendId]
    );
    return { id: newChat.id };
  }

  async deleteMessages(chatId: string | number, userId: string | number, allForEveryone: boolean): Promise<void> {
    if (allForEveryone) {
      await client.query("DELETE FROM messages WHERE chat_id = $1", [chatId]);
    } else {
      await client.query(
        `UPDATE messages SET deleted_for = array_append(deleted_for, $1)
         WHERE chat_id = $2 AND NOT deleted_for @> ARRAY[$1]::int[]`,
        [userId, chatId]
      );
    }
  }
}

export default new ChatService();