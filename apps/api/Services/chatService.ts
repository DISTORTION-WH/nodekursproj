import client from "../databasepg";
import crypto from "crypto";
import { QueryResult } from "pg";


export interface ChatParticipant {
  id: number;
  username: string;
  avatar_url?: string | null;
  invited_by_user_id?: number;
  chat_role: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: number[];
}

export interface ReplyTo {
  id: number;
  text: string;
  sender_name: string;
}

export interface Message {
  id: number;
  text: string;
  created_at: Date;
  chat_id: number;
  sender_id: number;
  sender?: { id: number; username: string };
  sender_name?: string;
  reply_to_id?: number | null;
  reply_to?: ReplyTo | null;
  reactions?: ReactionGroup[];
  edited_at?: Date | null;
  forwarded_from_id?: number | null;
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
      return chatsRes.rows;
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
      `SELECT u.id, u.username, u.avatar_url, cu.invited_by_user_id, cu.chat_role
       FROM users u JOIN chat_users cu ON u.id = cu.user_id WHERE cu.chat_id = $1`,
      [chatId]
    );
    return resDb.rows;
  }

  async getChatMemberRole(chatId: string | number, userId: string | number): Promise<string | null> {
    const result = await client.query(
      `SELECT chat_role FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userId]
    );
    return result.rows[0]?.chat_role ?? null;
  }

  async setChatMemberRole(chatId: string | number, targetUserId: string | number, newRole: string): Promise<void> {
    const validRoles = ['moderator', 'trusted', 'member'];
    if (!validRoles.includes(newRole)) {
      const err: any = new Error("Недопустимая роль. Допустимые: moderator, trusted, member");
      err.status = 400;
      throw err;
    }
    const result = await client.query(
      `UPDATE chat_users SET chat_role = $1 WHERE chat_id = $2 AND user_id = $3 RETURNING id`,
      [newRole, chatId, targetUserId]
    );
    if (result.rowCount === 0) {
      const err: any = new Error("Пользователь не найден в этом чате");
      err.status = 404;
      throw err;
    }
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
    const result = await client.query(
      `SELECT
         m.id, m.text, m.created_at, m.chat_id, u.id as sender_id, u.username as sender_name,
         u.avatar_url as sender_avatar,
         m.reply_to_id, m.edited_at, m.forwarded_from_id, m.expires_at,
         CASE WHEN rm.id IS NOT NULL THEN
           jsonb_build_object('id', rm.id, 'text', rm.text, 'sender_name', ru.username)
         ELSE NULL END as reply_to,
         COALESCE(
           (
             SELECT json_agg(jsonb_build_object('emoji', r.emoji, 'count', r.cnt, 'users', r.uids))
             FROM (
               SELECT emoji, COUNT(*) as cnt, array_agg(user_id) as uids
               FROM message_reactions
               WHERE message_id = m.id
               GROUP BY emoji
             ) r
           ),
           '[]'::json
         ) as reactions,
         (SELECT row_to_json(p) FROM polls p WHERE p.message_id = m.id LIMIT 1) as poll
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       WHERE m.chat_id = $1
         AND NOT EXISTS (SELECT 1 FROM message_deleted_for mdf WHERE mdf.message_id = m.id AND mdf.user_id = $2)
         AND (m.expires_at IS NULL OR m.expires_at > NOW())
       ORDER BY m.created_at ASC`,
      [chatId, userId]
    );
    return result.rows;
  }

  async postMessage(chatId: string | number, senderId: string | number, text: string, replyToId?: number | null, expiresInSeconds?: number | null): Promise<Message> {
    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;
    const result = await client.query(
      `INSERT INTO messages (chat_id, sender_id, text, reply_to_id, expires_at) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, text, created_at, sender_id, chat_id, reply_to_id, expires_at`,
      [chatId, senderId, text, replyToId ?? null, expiresAt]
    );
    const msg = result.rows[0];

    // Fetch sender info
    const senderRes = await client.query(
      `SELECT username, avatar_url FROM users WHERE id = $1`,
      [senderId]
    );
    const sender = senderRes.rows[0];

    // Fetch reply_to info if needed
    let reply_to = null;
    if (msg.reply_to_id) {
      const replyRes = await client.query(
        `SELECT m.id, m.text, u.username as sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1`,
        [msg.reply_to_id]
      );
      if (replyRes.rows.length > 0) reply_to = replyRes.rows[0];
    }

    return { ...msg, sender_name: sender?.username, sender_avatar: sender?.avatar_url, reply_to, reactions: [] };
  }

  async addReaction(messageId: number, userId: number, emoji: string): Promise<ReactionGroup[]> {
    await client.query(
      `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [messageId, userId, emoji]
    );
    return this.getReactions(messageId);
  }

  async removeReaction(messageId: number, userId: number, emoji: string): Promise<ReactionGroup[]> {
    await client.query(
      `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji]
    );
    return this.getReactions(messageId);
  }

  async getReactions(messageId: number): Promise<ReactionGroup[]> {
    const result = await client.query(
      `SELECT emoji, COUNT(*) as count, array_agg(user_id) as users
       FROM message_reactions WHERE message_id = $1 GROUP BY emoji`,
      [messageId]
    );
    return result.rows.map((r: { emoji: string; count: string | number; users: number[] }) => ({ emoji: r.emoji, count: Number(r.count), users: r.users }));
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
        `INSERT INTO message_deleted_for (message_id, user_id)
         SELECT id, $1 FROM messages WHERE chat_id = $2
         ON CONFLICT DO NOTHING`,
        [userId, chatId]
      );
    }
  }

  async getChatMessagesPaginated(chatId: string | number, userId: string | number, beforeId?: number, limit = 50): Promise<Message[]> {
    const params: any[] = [chatId, userId];
    let beforeClause = "";
    if (beforeId) {
      params.push(beforeId);
      beforeClause = `AND m.id < $${params.length}`;
    }
    params.push(limit);
    const result = await client.query(
      `SELECT
         m.id, m.text, m.created_at, m.chat_id, u.id as sender_id, u.username as sender_name,
         u.avatar_url as sender_avatar,
         m.reply_to_id, m.edited_at, m.forwarded_from_id,
         CASE WHEN rm.id IS NOT NULL THEN
           jsonb_build_object('id', rm.id, 'text', rm.text, 'sender_name', ru.username)
         ELSE NULL END as reply_to,
         COALESCE(
           (
             SELECT json_agg(jsonb_build_object('emoji', r.emoji, 'count', r.cnt, 'users', r.uids))
             FROM (
               SELECT emoji, COUNT(*) as cnt, array_agg(user_id) as uids
               FROM message_reactions
               WHERE message_id = m.id
               GROUP BY emoji
             ) r
           ),
           '[]'::json
         ) as reactions
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       WHERE m.chat_id = $1
         AND NOT EXISTS (SELECT 1 FROM message_deleted_for mdf WHERE mdf.message_id = m.id AND mdf.user_id = $2)
       ${beforeClause}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return result.rows.reverse();
  }

  async editMessage(messageId: number, userId: number, text: string): Promise<Message | null> {
    const result = await client.query(
      `UPDATE messages SET text = $1, edited_at = NOW()
       WHERE id = $2 AND sender_id = $3
       RETURNING id, text, edited_at, chat_id, sender_id, created_at, reply_to_id`,
      [text, messageId, userId]
    );
    return result.rows[0] || null;
  }

  async getUnreadCounts(userId: number): Promise<{ chat_id: number; unread: number }[]> {
    const result = await client.query(
      `SELECT cu.chat_id, COUNT(m.id)::int as unread
       FROM chat_users cu
       LEFT JOIN messages m ON m.chat_id = cu.chat_id
         AND NOT EXISTS (SELECT 1 FROM message_deleted_for mdf WHERE mdf.message_id = m.id AND mdf.user_id = $1)
         AND m.id > COALESCE(
           (SELECT last_read_message_id FROM chat_read_status WHERE user_id = $1 AND chat_id = cu.chat_id),
           0
         )
         AND m.sender_id != $1
       WHERE cu.user_id = $1
       GROUP BY cu.chat_id`,
      [userId]
    );
    return result.rows;
  }

  async markChatAsRead(chatId: number, userId: number): Promise<void> {
    await client.query(
      `INSERT INTO chat_read_status (user_id, chat_id, last_read_message_id, last_read_at)
       VALUES ($1, $2, (SELECT MAX(id) FROM messages WHERE chat_id = $2), NOW())
       ON CONFLICT (user_id, chat_id) DO UPDATE
         SET last_read_message_id = (SELECT MAX(id) FROM messages WHERE chat_id = $2),
             last_read_at = NOW()`,
      [userId, chatId]
    );
  }

  async getPinnedMessages(chatId: number): Promise<Message[]> {
    const result = await client.query(
      `SELECT m.id, m.text, m.created_at, m.chat_id, m.sender_id, u.username as sender_name,
              m.reply_to_id, m.edited_at, m.forwarded_from_id,
              '[]'::json as reactions
       FROM pinned_messages pm
       JOIN messages m ON pm.message_id = m.id
       JOIN users u ON m.sender_id = u.id
       WHERE pm.chat_id = $1
       ORDER BY pm.pinned_at DESC`,
      [chatId]
    );
    return result.rows;
  }

  async pinMessage(chatId: number, messageId: number, pinnedBy: number): Promise<void> {
    await client.query(
      `INSERT INTO pinned_messages (chat_id, message_id, pinned_by) VALUES ($1, $2, $3)
       ON CONFLICT (chat_id, message_id) DO NOTHING`,
      [chatId, messageId, pinnedBy]
    );
  }

  async unpinMessage(chatId: number, messageId: number): Promise<void> {
    await client.query(
      `DELETE FROM pinned_messages WHERE chat_id = $1 AND message_id = $2`,
      [chatId, messageId]
    );
  }

  async searchMessages(chatId: number, userId: number, query: string): Promise<Message[]> {
    const result = await client.query(
      `SELECT m.id, m.text, m.created_at, m.chat_id, m.sender_id, u.username as sender_name,
              m.reply_to_id, m.edited_at, '[]'::json as reactions
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.chat_id = $1
         AND NOT EXISTS (SELECT 1 FROM message_deleted_for mdf WHERE mdf.message_id = m.id AND mdf.user_id = $2)
         AND m.text ILIKE $3
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [chatId, userId, `%${query}%`]
    );
    return result.rows;
  }

  async forwardMessage(targetChatId: number, senderId: number, text: string, forwardedFromId: number): Promise<Message> {
    const result = await client.query(
      `INSERT INTO messages (chat_id, sender_id, text, forwarded_from_id) VALUES ($1, $2, $3, $4)
       RETURNING id, text, created_at, sender_id, chat_id, reply_to_id, edited_at, forwarded_from_id`,
      [targetChatId, senderId, text, forwardedFromId]
    );
    const msg = result.rows[0];
    const senderRes = await client.query(
      `SELECT username, avatar_url FROM users WHERE id = $1`,
      [senderId]
    );
    const sender = senderRes.rows[0];
    return { ...msg, sender_name: sender?.username, sender_avatar: sender?.avatar_url, reactions: [] };
  }
}

export default new ChatService();