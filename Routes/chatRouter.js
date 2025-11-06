const Router = require("express");
const router = new Router();
const client = require("../databasepg");
const authMiddleware = require("../middleware/authMiddleware");
const crypto = require("crypto");

router.use(authMiddleware);

router.get("/:id/users", async (req, res, next) => {
  const chatId = req.params.id;
  const requesterId = req.user.id;

  try {
    if (isNaN(parseInt(chatId, 10))) {
      const err = new Error("Неверный ID чата");
      err.status = 400; 
      throw err;
    }
    
    const memberCheck = await client.query(
      `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, requesterId]
    );

    if (memberCheck.rows.length === 0) {
      const err = new Error("Вы не являетесь участником этого чата");
      err.status = 403;
      throw err;
    }

    const membersRes = await client.query(
      `SELECT u.id, u.username, u.avatar_url, cu.invited_by_user_id
       FROM users u
       JOIN chat_users cu ON u.id = cu.user_id
       WHERE cu.chat_id = $1`,
      [chatId]
    );

    res.json(membersRes.rows);
  } catch (e) {
    console.error(`❗️ Ошибка в GET /chats/${chatId}/users:`, e.message, e.stack);
    next(e); 
  }
});

router.post("/:id/invite-code", async (req, res, next) => {
  const chatId = req.params.id;
  const userId = req.user.id;

  try {
    if (isNaN(parseInt(chatId, 10))) {
      const err = new Error("Неверный ID чата");
      err.status = 400;
      throw err;
    }

    const memberCheck = await client.query(
      `SELECT c.is_group, c.invite_code FROM chat_users cu
       JOIN chats c ON cu.chat_id = c.id
       WHERE cu.chat_id = $1 AND cu.user_id = $2`,
      [chatId, userId]
    );

    if (memberCheck.rows.length === 0) {
      const err = new Error("Вы не являетесь участником этого чата");
      err.status = 403;
      throw err;
    }
    
    const chat = memberCheck.rows[0];

    if (!chat.is_group) {
       const err = new Error("Нельзя создать приглашение для личного чата");
       err.status = 400;
       throw err;
    }

    if (chat.invite_code) {
      return res.json({ inviteCode: chat.invite_code });
    }

    let newCode = null;
    let attempts = 0;
    while (newCode === null && attempts < 5) {
      try {
        const code = crypto.randomBytes(4).toString('hex'); 
        await client.query(
          `UPDATE chats SET invite_code = $1 WHERE id = $2`,
          [code, chatId]
        );
        newCode = code;
      } catch (e) {
        if (e.code === '23505') {
            console.warn("Invite code collision, retrying...");
            attempts++;
        } else {
            throw e; 
        }
      }
    }
    
    if (!newCode) {
       const err = new Error("Не удалось сгенерировать код приглашения после нескольких попыток");
       err.status = 500;
       throw err;
    }

    res.status(201).json({ inviteCode: newCode });

  } catch (e) {
    console.error(`❗️ Ошибка в POST /chats/${chatId}/invite-code:`, e.message, e.stack);
    next(e);
  }
});

router.post("/join", async (req, res, next) => {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    try {
        if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim() === "") {
            const err = new Error("Код приглашения не предоставлен");
            err.status = 400;
            throw err;
        }

        const chatRes = await client.query(
            `SELECT id, name, is_group, creator_id FROM chats WHERE invite_code = $1 AND is_group = true`,
            [inviteCode]
        );

        if (chatRes.rows.length === 0) {
            const err = new Error("Неверный код приглашения");
            err.status = 404;
            throw err;
        }
        
        const chat = chatRes.rows[0];
        const chatId = chat.id;
        const creatorId = chat.creator_id; 

        const alreadyExists = await client.query(
            `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
            [chatId, userId]
        );
        if (alreadyExists.rows.length > 0) {
            const err = new Error("Вы уже состоите в этом чате");
            err.status = 400;
            throw err;
        }

        await client.query(
            `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`,
            [chatId, userId, creatorId]
        );

        res.status(201).json(chat);

    } catch (e) {
        console.error("❗️ Ошибка в POST /chats/join:", e.message, e.stack);
        next(e);
    }
});


router.post("/group", async (req, res, next) => {
  const { name } = req.body;
  const creatorId = req.user.id;

  try {
    if (!name || typeof name !== 'string' || name.trim() === "") {
      const err = new Error("Название комнаты не может быть пустым");
      err.status = 400;
      throw err;
    }

    const chatRes = await client.query(
      `INSERT INTO chats (name, is_group, creator_id) VALUES ($1, true, $2) RETURNING *`,
      [name, creatorId]
    );
    const newChat = chatRes.rows[0];

    await client.query(
      `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $2)`,
      [newChat.id, creatorId]
    );

    res.status(201).json(newChat);
  } catch (e) {
    console.error("❗️ Ошибка в POST /chats/group:", e.message, e.stack);
    next(e);
  }
});

router.post("/:id/invite", async (req, res, next) => {
  const chatId = req.params.id;
  const inviterId = req.user.id;
  const { friendId } = req.body; 

  try {
    if (isNaN(parseInt(chatId, 10))) {
      const err = new Error("Неверный ID чата");
      err.status = 400;
      throw err;
    }
    
    if (isNaN(parseInt(friendId, 10))) {
      const err = new Error("Не указан ID пользователя для приглашения");
      err.status = 400;
      throw err;
    }

    const memberCheck = await client.query(
      `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, inviterId]
    );
    if (memberCheck.rows.length === 0) {
      const err = new Error("Вы не являетесь участником этого чата");
      err.status = 403;
      throw err;
    }
    
    const alreadyExists = await client.query(
      `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, friendId]
    );
    if (alreadyExists.rows.length > 0) {
      const err = new Error("Пользователь уже в чате");
      err.status = 400;
      throw err;
    }

    await client.query(
      `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`,
      [chatId, friendId, inviterId]
    );

    res.json({ message: "Пользователь добавлен в комнату" });
  } catch (e) {
    console.error(`❗️ Ошибка в POST /chats/${chatId}/invite:`, e.message, e.stack);
    next(e);
  }
});

router.post("/:id/kick", async (req, res, next) => {
  const chatId = req.params.id;
  const kickerId = req.user.id; 
  const { userIdToKick } = req.body; 

  try {
    if (isNaN(parseInt(chatId, 10))) {
      const err = new Error("Неверный ID чата");
      err.status = 400;
      throw err;
    }
    
    if (isNaN(parseInt(userIdToKick, 10))) {
      const err = new Error("Не указан ID пользователя для удаления");
      err.status = 400;
      throw err;
    }

    const chatRes = await client.query(
      `SELECT creator_id FROM chats WHERE id = $1`,
      [chatId]
    );
    if (chatRes.rows.length === 0) {
      const err = new Error("Чат не найден");
      err.status = 404;
      throw err;
    }
    const isCreator = chatRes.rows[0].creator_id === kickerId;

    const memberRes = await client.query(
      `SELECT invited_by_user_id FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userIdToKick]
    );
    if (memberRes.rows.length === 0) {
      const err = new Error("Пользователь не найден в этом чате");
      err.status = 404;
      throw err;
    }
    const wasInvitedByKicker = memberRes.rows[0].invited_by_user_id === kickerId;
    
    const canKick = isCreator || wasInvitedByKicker;
    const isLeaving = kickerId === userIdToKick; 

    if (isLeaving) {
        await client.query(
            `DELETE FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
            [chatId, userIdToKick]
        );
        return res.json({ message: "Вы вышли из комнаты" });

    } else if (canKick) {
        await client.query(
            `DELETE FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
            [chatId, userIdToKick]
        );
        return res.json({ message: "Пользователь удален из комнаты" });

    } else {
        const err = new Error("У вас нет прав на удаление этого пользователя");
        err.status = 403;
        throw err;
    }

  } catch (e) {
    console.error(`❗️ Ошибка в POST /chats/${chatId}/kick:`, e.message, e.stack);
    next(e);
  }
});

router.get("/", async (req, res, next) => {
  const userId = req.user.id;
  try {
    const result = await client.query(
      `SELECT c.id, c.name, c.is_group, c.creator_id
       FROM chats c
       JOIN chat_users cu ON cu.chat_id = c.id
       WHERE cu.user_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error("❗️ Ошибка в GET /chats:", e.message, e.stack);
    next(e);
  }
});

router.get("/:id/messages", async (req, res, next) => {
  const chatId = req.params.id;
  const userId = req.user.id;

  try {
    if (isNaN(parseInt(chatId, 10))) {
      const err = new Error("Неверный ID чата");
      err.status = 400;
      throw err;
    }
    
    const result = await client.query(
      `SELECT m.id, m.text, m.created_at, m.chat_id, u.id as sender_id, u.username as sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.chat_id = $1
         AND NOT m.deleted_for @> ARRAY[$2]::int[]
       ORDER BY m.created_at ASC`,
      [chatId, userId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(`❗️ Ошибка в GET /chats/${chatId}/messages:`, e.message, e.stack);
    next(e);
  }
});

router.post("/:id/messages", async (req, res, next) => {
  const chatId = req.params.id;
  const senderId = req.user.id;
  const { text } = req.body;

  try {
    if (isNaN(parseInt(chatId, 10))) {
      const err = new Error("Неверный ID чата");
      err.status = 400;
      throw err;
    }
    
    if (!text || typeof text !== 'string' || text.trim() === "") {
        const err = new Error("Текст сообщения не может быть пустым");
        err.status = 400;
        throw err;
    }

    const chatExists = await client.query(
      "SELECT id FROM chats WHERE id = $1",
      [chatId]
    );
    if (chatExists.rows.length === 0) {
      const err = new Error("Чат не найден");
      err.status = 404;
      throw err;
    }

    const result = await client.query(
      `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) RETURNING id, text, created_at, sender_id, chat_id`,
      [chatId, senderId, text]
    );
    
    const newMessage = result.rows[0];
    newMessage.sender_name = req.user.username; 

    // --- 🆕 SOCKET.IO: Отправка сообщения в комнату чата ---
    const io = req.app.get('io');
    io.to(`chat_${chatId}`).emit('new_message', newMessage);
    // ------------------------------------------------------

    res.json(newMessage);
  } catch (e) {
    console.error(`❗️ Ошибка в POST /chats/${chatId}/messages:`, e.message, e.stack);
    next(e);
  }
});

router.post("/private", async (req, res, next) => {
  const userId = req.user.id;
  const { friendId } = req.body;

  try {
    if (isNaN(parseInt(friendId, 10))) {
      const err = new Error("Неверный ID друга");
      err.status = 400;
      throw err;
    }
    
    if (userId === friendId) {
       const err = new Error("Нельзя создать чат с самим собой");
       err.status = 400;
       throw err;
    }

    const existingChat = await client.query(
      `SELECT c.id
       FROM chats c
       JOIN chat_users cu1 ON cu1.chat_id = c.id
       JOIN chat_users cu2 ON cu2.chat_id = c.id
       WHERE c.is_group = false AND cu1.user_id = $1 AND cu2.user_id = $2`,
      [userId, friendId]
    );

    if (existingChat.rows.length > 0) {
      return res.json(existingChat.rows[0]); 
    }

    const newChat = await client.query(
      `INSERT INTO chats (name, is_group, creator_id) VALUES ('', false, $1) RETURNING id`,
      [userId]
    );

    const chatId = newChat.rows[0].id;

    await client.query(
      `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $2), ($1, $3, $2)`,
      [chatId, userId, friendId]
    );

    res.json({ id: chatId });
  } catch (e) {
    console.error("❗️ Ошибка в POST /chats/private:", e.message, e.stack);
    next(e);
  }
});

module.exports = router;