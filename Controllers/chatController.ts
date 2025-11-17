import { Request, Response, NextFunction } from 'express';
import chatService from "../Services/chatService";

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
      const chatId = req.params.id;
      const { userIdToKick } = req.body;
      
      await chatService.kickFromGroup(chatId, userIdToKick);

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
      const { allForEveryone } = req.body;

      if (!userId) {
         res.status(401).json({ message: "Пользователь не авторизован" });
         return;
      }

      await chatService.deleteMessages(chatId, userId, allForEveryone);

      if (allForEveryone) {
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
}

export default new ChatController();