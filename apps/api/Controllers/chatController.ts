import { Request, Response, NextFunction } from 'express';
import chatService from "../Services/chatService";
import client from "../databasepg";
import minioService from "../Services/minioService";
import linkPreviewService from "../Services/linkPreviewService";
import { AuthRequest } from "../middleware/authMiddleware";

class ChatController {
  async getChatUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = authReq.params.id as string;
      const requesterId = authReq.user?.id;

      if (!requesterId) {
        res.status(401).json({ message: "Пользователь не авторизован" });
        return;
      }

      const users = await chatService.getChatUsers(chatId, requesterId);
      res.json(users);
    } catch (e) {
      next(e);
    }
  }

  async createInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = req.params.id as string;
      const inviteCode = await chatService.createInviteCode(chatId);
      res.status(201).json({ inviteCode });
    } catch (e) {
      next(e);
    }
  }

  async joinWithInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { inviteCode } = req.body;
      const userId = authReq.user?.id;

      if (!userId) {
          res.status(401).json({ message: "Пользователь не авторизован" });
          return;
      }

      const chat = await chatService.joinWithInviteCode(inviteCode, userId);

      req.app
        .get("io")
        .to(`chat_${chat.id}`)
        .emit("chat_member_updated", { chatId: chat.id });

      res.status(201).json(chat);
    } catch (e) {
      next(e);
    }
  }

  async createGroupChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { name } = req.body;
      const creatorId = authReq.user?.id;

      if (!creatorId) {
        res.status(401).json({ message: "Пользователь не авторизован" });
        return;
      }

      if (!name || typeof name !== "string" || !name.trim()) {
        res.status(400).json({ message: "Название комнаты не может быть пустым" });
        return;
      }
      if (name.trim().length > 100) {
        res.status(400).json({ message: "Название комнаты не может быть длиннее 100 символов" });
        return;
      }

      const newChat = await chatService.createGroupChat(name.trim(), creatorId);
      res.status(201).json(newChat);
    } catch (e) {
      next(e);
    }
  }

  async inviteToGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id as string;
      const inviterId = authReq.user?.id;
      const friendId = Number(req.body.friendId);

      if (!inviterId) {
        res.status(401).json({ message: "Пользователь не авторизован" });
        return;
      }

      if (!friendId || isNaN(friendId)) {
        res.status(400).json({ message: "Некорректный ID пользователя" });
        return;
      }

      // Проверяем что приглашаемый пользователь существует
      const friendExists = await client.query<{ id: number }>(
        "SELECT id FROM users WHERE id = $1 AND is_banned = false",
        [friendId]
      );
      if (friendExists.rows.length === 0) {
        res.status(404).json({ message: "Пользователь не найден" });
        return;
      }

      // Проверяем что inviter сам состоит в чате
      const inviterMember = await client.query<{ user_id: number }>(
        "SELECT user_id FROM chat_users WHERE chat_id = $1 AND user_id = $2",
        [chatId, inviterId]
      );
      if (inviterMember.rows.length === 0) {
        res.status(403).json({ message: "Вы не являетесь участником этого чата" });
        return;
      }

      // Проверяем что friendId ещё не в чате
      const alreadyMember = await client.query<{ user_id: number }>(
        "SELECT user_id FROM chat_users WHERE chat_id = $1 AND user_id = $2",
        [chatId, friendId]
      );
      if (alreadyMember.rows.length > 0) {
        res.status(409).json({ message: "Пользователь уже является участником чата" });
        return;
      }

      // Проверяем права: глобальный admin/mod, владелец чата, модератор или trusted в комнате
      const userRoleRes = await client.query<{ role: string }>(
        `SELECT r.value as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
        [inviterId]
      );
      const globalRole = userRoleRes.rows[0]?.role ?? "USER";
      const chatRes = await client.query<{ creator_id: number }>(
        "SELECT creator_id FROM chats WHERE id = $1",
        [chatId]
      );
      if (chatRes.rows.length === 0) {
        res.status(404).json({ message: "Чат не найден" });
        return;
      }
      const creatorId = chatRes.rows[0].creator_id;
      const isOwner = Number(creatorId) === Number(inviterId);
      const roomRole = await chatService.getChatMemberRole(chatId, inviterId);
      const canInvite =
        globalRole === "ADMIN" ||
        globalRole === "MODERATOR" ||
        isOwner ||
        roomRole === "moderator" ||
        roomRole === "trusted";

      if (!canInvite) {
        res.status(403).json({ message: "Нет прав для приглашения" });
        return;
      }

      await chatService.inviteToGroup(chatId, friendId, inviterId);

      req.app.get("io").to(`user_${friendId}`).emit("added_to_chat", { chatId });
      req.app.get("io").to(`chat_${chatId}`).emit("chat_member_updated", { chatId });

      res.json({ message: "Приглашен" });
    } catch (e) {
      next(e);
    }
  }

  // --- ИЗМЕНЕННЫЙ МЕТОД ДЛЯ УДАЛЕНИЯ ПОЛЬЗОВАТЕЛЯ ---
  async kickFromGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id as string;
      const requesterId = authReq.user?.id;
      const { userIdToKick } = req.body;

      if (!requesterId) {
         res.status(401).json({ message: "Пользователь не авторизован" });
         return;
      }

      // 1. Получаем актуальную роль из БД (чтобы работало сразу после выдачи прав)
      const userRoleRes = await client.query(
          `SELECT r.value as role FROM users u 
           LEFT JOIN roles r ON u.role_id = r.id 
           WHERE u.id = $1`, 
           [requesterId]
      );
      const currentRole = userRoleRes.rows[0]?.role || 'USER';

      // 2. Узнаем, кто создатель чата
      const chatRes = await client.query('SELECT creator_id FROM chats WHERE id = $1', [chatId]);
      if (chatRes.rows.length === 0) {
          res.status(404).json({ message: "Чат не найден" });
          return;
      }
      const creatorId = chatRes.rows[0].creator_id;

      // 3. Проверка прав: Глобальный Админ, Глобальный Модератор, Создатель чата или Модератор комнаты
      const isPrivileged = currentRole === 'ADMIN' || currentRole === 'MODERATOR';
      const isCreator = Number(creatorId) === Number(requesterId);
      const roomRole = await chatService.getChatMemberRole(chatId, requesterId);
      const isRoomModerator = roomRole === 'moderator';

      if (isPrivileged || isCreator || isRoomModerator) {
        const kickRes = await client.query(
          "DELETE FROM chat_users WHERE chat_id = $1 AND user_id = $2",
          [chatId, userIdToKick]
        );
        if (!kickRes.rowCount || kickRes.rowCount === 0) {
          res.status(404).json({ message: "Пользователь не является участником чата" });
          return;
        }

        req.app.get("io").to(`user_${userIdToKick}`).emit("removed_from_chat", { chatId });
        req.app.get("io").to(`chat_${chatId}`).emit("chat_member_updated", { chatId });

        res.json({ message: "Удален из комнаты" });
      } else {
        res.status(403).json({ message: "Нет прав для удаления участника" });
      }
    } catch (e) {
      next(e);
    }
  }
  // ---------------------------------------------------

  async getAllUserChats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Пользователь не авторизован" });
        return;
      }

      const chats = await chatService.getAllUserChats(userId);
      res.json(chats);
    } catch (e) {
      next(e);
    }
  }

  async getChatMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id as string;
      const userId = authReq.user?.id;
      const beforeId = req.query.before ? Number(req.query.before as string) : undefined;

      if (!userId) {
        res.status(401).json({ message: "Пользователь не авторизован" });
        return;
      }

      const messages = beforeId !== undefined
        ? await chatService.getChatMessagesPaginated(chatId, userId, beforeId)
        : await chatService.getChatMessages(chatId, userId);
      res.json(messages);
    } catch (e) {
      next(e);
    }
  }

  async getUnreadCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      const counts = await chatService.getUnreadCounts(userId);
      res.json(counts);
    } catch (e) { next(e); }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const chatId = Number(req.params.id);
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      await chatService.markChatAsRead(chatId, userId);
      res.json({ message: "ok" });
    } catch (e) { next(e); }
  }

  async editMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const msgId = Number(req.params.id);
      const { text } = req.body;
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (!text?.trim()) { res.status(400).json({ message: "Текст не может быть пустым" }); return; }
      const updated = await chatService.editMessage(msgId, userId, text.trim());
      if (!updated) { res.status(403).json({ message: "Нет прав или сообщение не найдено" }); return; }
      req.app.get("io").to(`chat_${updated.chat_id}`).emit("message_edited", {
        messageId: updated.id,
        chatId: updated.chat_id,
        text: updated.text,
        edited_at: updated.edited_at,
      });
      res.json(updated);
    } catch (e) { next(e); }
  }

  async getPinnedMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chatId = Number(req.params.id);
      const pinned = await chatService.getPinnedMessages(chatId);
      res.json(pinned);
    } catch (e) { next(e); }
  }

  async pinMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const msgId = Number(req.params.msgId);
      const { chatId } = req.body;
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (isNaN(msgId)) { res.status(400).json({ message: "Некорректный ID сообщения" }); return; }
      if (!chatId) { res.status(400).json({ message: "Не указан chatId" }); return; }

      // Check role: global admin/mod, room owner or room moderator
      const roleRes = await client.query(
        `SELECT r.value as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, [userId]
      );
      const role = roleRes.rows[0]?.role || 'USER';
      const chatRes = await client.query("SELECT creator_id FROM chats WHERE id = $1", [chatId]);
      const isCreator = Number(chatRes.rows[0]?.creator_id) === Number(userId);
      const isPrivileged = role === 'ADMIN' || role === 'MODERATOR';
      const roomRolePin = await chatService.getChatMemberRole(chatId, userId);
      const isRoomMod = roomRolePin === 'moderator';

      if (!isCreator && !isPrivileged && !isRoomMod) {
        res.status(403).json({ message: "Нет прав для закрепления" });
        return;
      }

      await chatService.pinMessage(Number(chatId), msgId, userId);
      const pinned = await chatService.getPinnedMessages(Number(chatId));
      req.app.get("io").to(`chat_${chatId}`).emit("message_pinned", { chatId: Number(chatId), message: pinned[0] });
      res.json({ message: "Закреплено" });
    } catch (e) { next(e); }
  }

  async unpinMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const msgId = Number(req.params.msgId);
      const { chatId } = req.body;
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (isNaN(msgId)) { res.status(400).json({ message: "Некорректный ID сообщения" }); return; }
      if (!chatId) { res.status(400).json({ message: "Не указан chatId" }); return; }

      const roleRes = await client.query(
        `SELECT r.value as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, [userId]
      );
      const role = roleRes.rows[0]?.role || 'USER';
      const chatRes = await client.query("SELECT creator_id FROM chats WHERE id = $1", [chatId]);
      const isCreator = Number(chatRes.rows[0]?.creator_id) === Number(userId);
      const isPrivileged = role === 'ADMIN' || role === 'MODERATOR';
      const roomRoleUnpin = await chatService.getChatMemberRole(chatId, userId);
      const isRoomModUnpin = roomRoleUnpin === 'moderator';

      if (!isCreator && !isPrivileged && !isRoomModUnpin) {
        res.status(403).json({ message: "Нет прав" });
        return;
      }

      await chatService.unpinMessage(Number(chatId), msgId);
      req.app.get("io").to(`chat_${chatId}`).emit("message_unpinned", { chatId: Number(chatId), messageId: msgId });
      res.json({ message: "Откреплено" });
    } catch (e) { next(e); }
  }

  async searchMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const chatId = Number(req.params.id);
      const query = String(req.query.q || "").trim();
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (!query) { res.json([]); return; }
      const results = await chatService.searchMessages(chatId, userId, query);
      res.json(results);
    } catch (e) { next(e); }
  }

  async forwardMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const targetChatId = Number(req.params.id);
      const { text, forwardedFromId } = req.body;
      if (!userId || !authReq.user) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (isNaN(targetChatId)) { res.status(400).json({ message: "Некорректный ID чата" }); return; }

      // Verify user is a member of the target chat before forwarding
      const memberCheck = await client.query(
        "SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2",
        [targetChatId, userId]
      );
      if (memberCheck.rows.length === 0) {
        res.status(403).json({ message: "Нет доступа к целевому чату" });
        return;
      }

      const msg = await chatService.forwardMessage(targetChatId, userId, text, forwardedFromId);
      req.app.get("io").to(`chat_${targetChatId}`).emit("new_message", msg);
      res.json(msg);
    } catch (e) { next(e); }
  }

  async uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const chatId = req.params.id as string;
      const file = req.file;
      if (!userId || !authReq.user) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (!file) { res.status(400).json({ message: "Файл не загружен" }); return; }
      const url = await minioService.uploadFile(file);
      const msg = await chatService.postMessage(chatId, userId, url);
      req.app.get("io").to(`chat_${chatId}`).emit("new_message", msg);
      res.json(msg);
    } catch (e) { next(e); }
  }

  async getLinkPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const url = String(req.query.url || "").trim();
      if (!url) { res.status(400).json({ message: "URL не указан" }); return; }
      const preview = await linkPreviewService.getPreview(url);
      res.json(preview);
    } catch (e) { next(e); }
  }

  async postMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id as string;
      const senderId = authReq.user?.id;
      const { text, reply_to_id, expires_in_seconds } = req.body;

      if (!senderId || !authReq.user) {
          res.status(401).json({ message: "Пользователь не авторизован" });
          return;
      }

      if (!text || typeof text !== "string" || !text.trim()) {
        res.status(400).json({ message: "Текст сообщения не может быть пустым" });
        return;
      }
      if (text.length > 10_000) {
        res.status(400).json({ message: "Сообщение слишком длинное (максимум 10 000 символов)" });
        return;
      }

      const msg = await chatService.postMessage(chatId, senderId, text, reply_to_id ?? null, expires_in_seconds ?? null);

      // ─── Process @mentions ───────────────────────────────────────────
      const mentionRegex = /@(\w+)/g;
      const mentionedUsernames: string[] = [];
      let m;
      while ((m = mentionRegex.exec(text)) !== null) {
        mentionedUsernames.push(m[1]);
      }
      if (mentionedUsernames.length > 0) {
        // Find mentioned users who are members of this chat
        const usersRes = await client.query(
          `SELECT u.id FROM users u
           JOIN chat_users cu ON cu.user_id = u.id AND cu.chat_id = $1
           WHERE u.username = ANY($2) AND u.id != $3`,
          [chatId, mentionedUsernames, senderId]
        );
        for (const row of usersRes.rows) {
          await client.query(
            "INSERT INTO message_mentions (message_id, mentioned_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [msg.id, row.id]
          );
          req.app.get("io").to(`user_${row.id}`).emit("mention_received", {
            messageId: msg.id,
            chatId: Number(chatId),
            senderName: authReq.user.username,
            text,
          });
        }
      }

      req.app.get("io").to(`chat_${chatId}`).emit("new_message", msg);

      res.json(msg);
    } catch (e) {
      next(e);
    }
  }

  async reactToMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const msgId = Number(req.params.msgId);
      const { emoji } = req.body;

      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (isNaN(msgId)) { res.status(400).json({ message: "Некорректный ID сообщения" }); return; }
      if (!emoji || typeof emoji !== "string") { res.status(400).json({ message: "Не указан emoji" }); return; }
      if (emoji.length > 10) { res.status(400).json({ message: "Некорректный emoji" }); return; }

      const reactions = await chatService.addReaction(msgId, userId, emoji);

      // Find chat_id to emit socket event to the right room
      const msgRes = await client.query("SELECT chat_id FROM messages WHERE id = $1", [msgId]);
      if (msgRes.rows.length > 0) {
        req.app.get("io").to(`chat_${msgRes.rows[0].chat_id}`).emit("reaction_updated", { messageId: msgId, reactions });
      }

      res.json({ reactions });
    } catch (e) {
      next(e);
    }
  }

  async unreactToMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const msgId = Number(req.params.msgId);
      const { emoji } = req.body;

      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (isNaN(msgId)) { res.status(400).json({ message: "Некорректный ID сообщения" }); return; }
      if (!emoji || typeof emoji !== "string") { res.status(400).json({ message: "Не указан emoji" }); return; }
      if (emoji.length > 10) { res.status(400).json({ message: "Некорректный emoji" }); return; }

      const reactions = await chatService.removeReaction(msgId, userId, emoji);

      const msgRes = await client.query("SELECT chat_id FROM messages WHERE id = $1", [msgId]);
      if (msgRes.rows.length > 0) {
        req.app.get("io").to(`chat_${msgRes.rows[0].chat_id}`).emit("reaction_updated", { messageId: msgId, reactions });
      }

      res.json({ reactions });
    } catch (e) {
      next(e);
    }
  }

  async findOrCreatePrivateChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const { friendId } = req.body;

      if (!userId) {
        res.status(401).json({ message: "Пользователь не авторизован" });
        return;
      }

      const chat = await chatService.findOrCreatePrivateChat(userId, friendId);
      res.json(chat);
    } catch (e) {
      next(e);
    }
  }

  async deleteMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id as string;
      const userId = authReq.user?.id;

      if (!userId) {
          res.status(401).json({ message: "Пользователь не авторизован" });
          return;
      }

      // Получаем актуальную роль
      const userRoleRes = await client.query(
        `SELECT r.value as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, 
        [userId]
      );
      const userRole = userRoleRes.rows[0]?.role || 'USER';
      
      const { allForEveryone } = req.body;

      const isPrivileged = userRole === 'ADMIN' || userRole === 'MODERATOR';

      // Check room owner/moderator status for "delete for everyone"
      const chatRes = await client.query<{ creator_id: number }>("SELECT creator_id FROM chats WHERE id = $1", [chatId]);
      const isRoomOwner = chatRes.rows.length > 0 && chatRes.rows[0].creator_id === userId;
      const roomRole = await chatService.getChatMemberRole(chatId, userId);
      const isRoomMod = roomRole === 'moderator';

      const canDeleteForAll = isPrivileged || isRoomOwner || isRoomMod;

      if (allForEveryone && !canDeleteForAll) {
        res.status(403).json({ message: "Нет прав для удаления сообщений для всех" });
        return;
      }

      await chatService.deleteMessages(chatId, userId, allForEveryone && canDeleteForAll);

      if (allForEveryone && canDeleteForAll) {
        req.app.get("io").to(`chat_${chatId}`).emit("messages_cleared", { chatId });
      }

      res.json({ message: "Сообщения удалены" });
    } catch (e) {
      next(e);
    }
  }

  async deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params; 
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Не авторизован" });
        return;
      }
      
      // Получаем актуальную роль
      const userRoleRes = await client.query(
        `SELECT r.value as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, 
        [userId]
      );
      const userRole = userRoleRes.rows[0]?.role || 'USER';

      const msgRes = await client.query("SELECT chat_id, sender_id FROM messages WHERE id = $1", [id]);
      if (msgRes.rows.length === 0) {
        res.status(404).json({ message: "Сообщение не найдено" });
        return;
      }
      const { chat_id, sender_id } = msgRes.rows[0];

      const isAuthor = sender_id === userId;
      const isPrivileged = userRole === 'ADMIN' || userRole === 'MODERATOR';
      const roomRoleDel = await chatService.getChatMemberRole(chat_id, userId);
      const isRoomModDel = roomRoleDel === 'moderator';

      if (!isAuthor && !isPrivileged && !isRoomModDel) {
        res.status(403).json({ message: "Нет прав" });
        return;
      }

      await client.query("DELETE FROM messages WHERE id = $1", [id]);

      req.app.get("io").to(`chat_${chat_id}`).emit("message_deleted", { messageId: id, chatId: chat_id });

      res.json({ message: "Сообщение удалено" });
    } catch (e) {
      next(e);
    }
  }

  async setChatMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const requesterId = authReq.user?.id;
      const chatId = req.params.id as string;
      const targetUserId = Number(req.params.userId as string);
      const { role } = req.body;

      if (!requesterId) { res.status(401).json({ message: "Не авторизован" }); return; }

      // Only global ADMIN or room owner can assign roles
      const userRoleRes = await client.query(
        `SELECT r.value as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, [requesterId]
      );
      const globalRole = userRoleRes.rows[0]?.role || 'USER';
      const chatRes = await client.query('SELECT creator_id FROM chats WHERE id = $1', [chatId]);
      if (chatRes.rows.length === 0) { res.status(404).json({ message: "Чат не найден" }); return; }
      const creatorId = chatRes.rows[0].creator_id;

      const isOwner = Number(creatorId) === Number(requesterId);
      const isGlobalAdmin = globalRole === 'ADMIN';

      if (!isOwner && !isGlobalAdmin) {
        res.status(403).json({ message: "Только владелец комнаты или администратор может назначать роли" });
        return;
      }

      // Cannot change the owner's own role
      if (Number(targetUserId) === Number(creatorId)) {
        res.status(400).json({ message: "Нельзя изменить роль владельца комнаты" });
        return;
      }

      await chatService.setChatMemberRole(chatId, targetUserId, role);

      req.app.get("io").to(`chat_${chatId}`).emit("chat_member_updated", { chatId: Number(chatId) });

      res.json({ message: "Роль обновлена" });
    } catch (e) {
      next(e);
    }
  }

  // ─── Media Gallery ────────────────────────────────────────────────────────
  async getMediaGallery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id;
      const userId = authReq.user?.id;
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      const memberCheck = await client.query("SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2", [chatId, userId]);
      if (memberCheck.rows.length === 0) { res.status(403).json({ message: "Нет доступа" }); return; }
      const result = await client.query(
        `SELECT m.id, m.text, m.created_at, m.sender_id, u.username as sender_name
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.chat_id = $1
           AND NOT EXISTS (SELECT 1 FROM message_deleted_for mdf WHERE mdf.message_id = m.id AND mdf.user_id = $2)
           AND (m.text LIKE 'https://%' OR m.text LIKE 'http://%')
           AND (m.text ~ '\\.(jpg|jpeg|png|gif|webp|mp4|webm|mp3|pdf|zip)($|\\?)' OR m.text LIKE '%/stickers/%' OR m.text LIKE '%/uploads/%')
         ORDER BY m.created_at DESC LIMIT 100`,
        [chatId, userId]
      );
      res.json(result.rows);
    } catch (e) { next(e); }
  }

  // ─── Export chat history ──────────────────────────────────────────────────
  async exportChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id;
      const userId = authReq.user?.id;
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      const memberCheck = await client.query("SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2", [chatId, userId]);
      if (memberCheck.rows.length === 0) { res.status(403).json({ message: "Нет доступа" }); return; }
      const chatInfo = await client.query("SELECT name FROM chats WHERE id = $1", [chatId]);
      const msgs = await client.query(
        `SELECT m.id, m.text, m.created_at, u.username as sender_name
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.chat_id = $1
           AND NOT EXISTS (SELECT 1 FROM message_deleted_for mdf WHERE mdf.message_id = m.id AND mdf.user_id = $2)
         ORDER BY m.created_at ASC`,
        [chatId, userId]
      );
      const exportData = {
        chat: { id: chatId, name: chatInfo.rows[0]?.name },
        exported_at: new Date().toISOString(),
        messages: msgs.rows.map((m) => ({
          id: m.id,
          sender: m.sender_name,
          text: m.text,
          time: m.created_at,
        })),
      };
      res.setHeader("Content-Disposition", `attachment; filename=chat-${chatId}.json`);
      res.json(exportData);
    } catch (e) { next(e); }
  }

  // ─── Polls ────────────────────────────────────────────────────────────────
  async createPoll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id;
      const userId = authReq.user?.id;
      const { question, options, expires_in_seconds } = req.body as { question: string; options: string[]; expires_in_seconds?: number };
      const normalizedChatId = Number(chatId);
      const trimmedQuestion = typeof question === "string" ? question.trim().slice(0, 300) : "";
      const trimmedOptions = Array.isArray(options)
        ? options.map((o) => String(o).trim().slice(0, 100)).filter(Boolean)
        : [];
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (!Number.isInteger(normalizedChatId) || normalizedChatId <= 0 || !trimmedQuestion || trimmedOptions.length < 2 || trimmedOptions.length > 10) {
        res.status(400).json({ message: "Некорректные данные опроса" }); return;
      }
      const memberRes = await client.query(
        "SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2",
        [normalizedChatId, userId]
      );
      if (memberRes.rows.length === 0) {
        res.status(403).json({ message: "No access to chat" });
        return;
      }

      const expiresAt = Number.isFinite(expires_in_seconds) && Number(expires_in_seconds) > 0
        ? new Date(Date.now() + Number(expires_in_seconds) * 1000)
        : null;
      const msgRes = await client.query(
        `INSERT INTO messages (chat_id, sender_id, text, expires_at) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        [normalizedChatId, userId, `Poll: ${trimmedQuestion}`, expiresAt]
      );
      const msg = msgRes.rows[0];
      const pollRes = await client.query(
        `INSERT INTO polls (chat_id, creator_id, question, message_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [normalizedChatId, userId, trimmedQuestion, msg.id]
      );
      const pollId = pollRes.rows[0].id;
      for (let i = 0; i < trimmedOptions.length; i++) {
        await client.query(
          `INSERT INTO poll_options (poll_id, option_index, option_text) VALUES ($1, $2, $3)`,
          [pollId, i, trimmedOptions[i]]
        );
      }
      const io = req.app.get("io");
      const senderRes = await client.query("SELECT username, avatar_url FROM users WHERE id = $1", [userId]);
      const sender = senderRes.rows[0];
      io.to(`chat_${normalizedChatId}`).emit("new_message", {
        id: msg.id, chat_id: normalizedChatId, sender_id: userId,
        sender_name: sender?.username, sender_avatar: sender?.avatar_url,
        text: `Poll: ${trimmedQuestion}`, created_at: msg.created_at,
        poll: { id: pollId, question: trimmedQuestion, options: trimmedOptions, votes: {}, closed: false },
        reactions: [],
      });
      res.json({ pollId, messageId: msg.id });
    } catch (e) { next(e); }
  }

  // ─── Scheduled messages ───────────────────────────────────────────────────
  async createScheduledMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id;
      const userId = authReq.user?.id;
      const { text, send_at } = req.body as { text: string; send_at: string };
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      if (!text?.trim() || !send_at) { res.status(400).json({ message: "Не указан текст или время" }); return; }
      const sendDate = new Date(send_at);
      if (isNaN(sendDate.getTime()) || sendDate <= new Date()) {
        res.status(400).json({ message: "Некорректное время отправки" }); return;
      }
      const result = await client.query(
        "INSERT INTO scheduled_messages (chat_id, sender_id, text, send_at) VALUES ($1, $2, $3, $4) RETURNING *",
        [chatId, userId, text.trim(), sendDate]
      );
      res.json(result.rows[0]);
    } catch (e) { next(e); }
  }

  async getScheduledMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id;
      const userId = authReq.user?.id;
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      const result = await client.query(
        "SELECT * FROM scheduled_messages WHERE chat_id = $1 AND sender_id = $2 AND sent = false ORDER BY send_at ASC",
        [chatId, userId]
      );
      res.json(result.rows);
    } catch (e) { next(e); }
  }

  async deleteScheduledMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id;
      const msgId = req.params.msgId;
      const userId = authReq.user?.id;
      if (!userId) { res.status(401).json({ message: "Не авторизован" }); return; }
      await client.query("DELETE FROM scheduled_messages WHERE id = $1 AND chat_id = $2 AND sender_id = $3", [msgId, chatId, userId]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  }

  async reportMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { messageId, reason } = req.body;
      const reporterId = req.user?.id;

      if (!reporterId) {
        res.status(401).json({ message: "Не авторизован" });
        return;
      }
      if (!messageId || !reason || typeof reason !== "string" || !reason.trim()) {
        res.status(400).json({ message: "Не указано сообщение или причина" });
        return;
      }

      // Verify message exists and get its chat
      const msgRes = await client.query<{ chat_id: number; sender_id: number }>(
        "SELECT chat_id, sender_id FROM messages WHERE id = $1",
        [messageId]
      );
      if (msgRes.rows.length === 0) {
        res.status(404).json({ message: "Сообщение не найдено" });
        return;
      }
      const { chat_id, sender_id } = msgRes.rows[0];

      // Reporter must not report their own message
      if (sender_id === reporterId) {
        res.status(400).json({ message: "Нельзя пожаловаться на своё сообщение" });
        return;
      }

      // Reporter must be a member of that chat
      const memberRes = await client.query(
        "SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2",
        [chat_id, reporterId]
      );
      if (memberRes.rows.length === 0) {
        res.status(403).json({ message: "Нет доступа к этому чату" });
        return;
      }

      // Prevent duplicate reports from same user
      const dupRes = await client.query(
        "SELECT 1 FROM reports WHERE reporter_id = $1 AND message_id = $2",
        [reporterId, messageId]
      );
      if (dupRes.rows.length > 0) {
        res.status(409).json({ message: "Вы уже отправляли жалобу на это сообщение" });
        return;
      }

      await client.query(
        "INSERT INTO reports (reporter_id, reported_user_id, message_id, reason) VALUES ($1, $2, $3, $4)",
        [reporterId, sender_id, messageId, reason.trim()]
      );

      res.json({ message: "Жалоба отправлена" });
    } catch (e: unknown) {
      next(e);
    }
  }
}

export default new ChatController();
