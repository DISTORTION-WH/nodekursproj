const chatService = require("../Services/chatService");

class ChatController {
  async getChatUsers(req, res, next) {
    try {
      const chatId = req.params.id;
      const requesterId = req.user.id;
      const users = await chatService.getChatUsers(chatId, requesterId);
      res.json(users);
    } catch (e) {
      next(e);
    }
  }

  async createInviteCode(req, res, next) {
    try {
      const chatId = req.params.id;
      const inviteCode = await chatService.createInviteCode(chatId);
      res.status(201).json({ inviteCode });
    } catch (e) {
      next(e);
    }
  }

  async joinWithInviteCode(req, res, next) {
    try {
      const { inviteCode } = req.body;
      const userId = req.user.id;
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

  async createGroupChat(req, res, next) {
    try {
      const { name } = req.body;
      const creatorId = req.user.id;
      const newChat = await chatService.createGroupChat(name, creatorId);
      res.status(201).json(newChat);
    } catch (e) {
      next(e);
    }
  }

  async inviteToGroup(req, res, next) {
    try {
      const chatId = req.params.id;
      const inviterId = req.user.id;
      const { friendId } = req.body;
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

  async kickFromGroup(req, res, next) {
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

  async getAllUserChats(req, res, next) {
    try {
      const userId = req.user.id;
      const chats = await chatService.getAllUserChats(userId);
      res.json(chats);
    } catch (e) {
      next(e);
    }
  }

  async getChatMessages(req, res, next) {
    try {
      const chatId = req.params.id;
      const userId = req.user.id;
      const messages = await chatService.getChatMessages(chatId, userId);
      res.json(messages);
    } catch (e) {
      next(e);
    }
  }

  async postMessage(req, res, next) {
    try {
      const chatId = req.params.id;
      const senderId = req.user.id;
      const { text } = req.body;
      const msg = await chatService.postMessage(chatId, senderId, text);

      msg.sender_name = req.user.username;
      req.app.get("io").to(`chat_${chatId}`).emit("new_message", msg);

      res.json(msg);
    } catch (e) {
      next(e);
    }
  }

  async findOrCreatePrivateChat(req, res, next) {
    try {
      const userId = req.user.id;
      const { friendId } = req.body;
      const chat = await chatService.findOrCreatePrivateChat(userId, friendId);
      res.json(chat);
    } catch (e) {
      next(e);
    }
  }

  async deleteMessages(req, res, next) {
    try {
      const chatId = req.params.id;
      const userId = req.user.id;
      const { allForEveryone } = req.body;

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

module.exports = new ChatController();
