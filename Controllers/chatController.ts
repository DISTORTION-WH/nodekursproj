import { Request, Response, NextFunction } from 'express';
import chatService from "../Services/chatService";
import client from "../databasepg";

interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role?: string;
  };
}

class ChatController {
  async getChatUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = authReq.params.id;
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
      const chatId = req.params.id;
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

      const newChat = await chatService.createGroupChat(name, creatorId);
      res.status(201).json(newChat);
    } catch (e) {
      next(e);
    }
  }

  async inviteToGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id;
      const inviterId = authReq.user?.id;
      const { friendId } = req.body;

      if (!inviterId) {
          res.status(401).json({ message: "Пользователь не авторизован" });
          return;
      }

      await chatService.inviteToGroup(chatId, friendId, inviterId);

      req.app
        .get("io")
        .to(`user_${friendId}`)
        .emit("added_to_chat", { chatId });
      req.app
        .get("io")
        .to(`chat_${chatId}`)
        .emit("chat_member_updated", { chatId });

      res.json({ message: "Приглашен" });
    } catch (e) {
      next(e);
    }
  }

  async kickFromGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id;
      const { userIdToKick } = req.body;
      const requesterRole = authReq.user?.role;
      
      const isPrivileged = requesterRole === 'ADMIN' || requesterRole === 'MODERATOR';

      if (isPrivileged) {
        await client.query("DELETE FROM chat_users WHERE chat_id = $1 AND user_id = $2", [chatId, userIdToKick]);
      } else {
        await chatService.kickFromGroup(chatId, userIdToKick);
      }

      req.app
        .get("io")
        .to(`user_${userIdToKick}`)
        .emit("removed_from_chat", { chatId });
      req.app
        .get("io")
        .to(`chat_${chatId}`)
        .emit("chat_member_updated", { chatId });

      res.json({ message: "Удален из комнаты" });
    } catch (e) {
      next(e);
    }
  }

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
      const chatId = req.params.id;
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Пользователь не авторизован" });
        return;
      }

      const messages = await chatService.getChatMessages(chatId, userId);
      res.json(messages);
    } catch (e) {
      next(e);
    }
  }

  async postMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const chatId = req.params.id;
      const senderId = authReq.user?.id;
      const { text } = req.body;

      if (!senderId || !authReq.user) {
          res.status(401).json({ message: "Пользователь не авторизован" });
          return;
      }

      const msg = await chatService.postMessage(chatId, senderId, text);

      const msgWithSender = { ...msg, sender_name: authReq.user.username };

      req.app.get("io").to(`chat_${chatId}`).emit("new_message", msgWithSender);

      res.json(msgWithSender);
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
      const chatId = req.params.id;
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;
      const { allForEveryone } = req.body;

      if (!userId) {
          res.status(401).json({ message: "Пользователь не авторизован" });
          return;
      }

      const isPrivileged = userRole === 'ADMIN' || userRole === 'MODERATOR';

      if (isPrivileged) {
          await chatService.deleteMessages(chatId, userId, true);
      } else {
          await chatService.deleteMessages(chatId, userId, allForEveryone);
      }

      if (allForEveryone || isPrivileged) {
        req.app
          .get("io")
          .to(`chat_${chatId}`)
          .emit("messages_cleared", { chatId });
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
      const userRole = authReq.user?.role;

      if (!userId) {
        res.status(401).json({ message: "Не авторизован" });
        return;
      }

      const msgRes = await client.query("SELECT chat_id, sender_id FROM messages WHERE id = $1", [id]);
      if (msgRes.rows.length === 0) {
        res.status(404).json({ message: "Сообщение не найдено" });
        return;
      }
      const { chat_id, sender_id } = msgRes.rows[0];

      const isAuthor = sender_id === userId;
      const isPrivileged = userRole === 'ADMIN' || userRole === 'MODERATOR';

      if (!isAuthor && !isPrivileged) {
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

async reportMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { messageId, reason } = req.body;
      const reporterId = req.user?.id;

      if (!messageId || !reason) {
        res.status(400).json({ message: "Не указано сообщение или причина" });
        return;
      }

      await client.query(
        "INSERT INTO reports (reporter_id, message_id, reason) VALUES ($1, $2, $3)",
        [reporterId, messageId, reason]
      );

      res.json({ message: "Жалоба отправлена" });
    } catch (e: any) {
      next(e);
    }
  }
}

export default new ChatController();