const Router = require("express");
const router = new Router();
const client = require("../databasepg");
const authMiddleware = require("../middleware/authMiddleware");
const crypto = require("crypto"); // 👈 ДОБАВЬТЕ ЭТО

router.use(authMiddleware);

// --- НОВЫЙ МАРШРУТ: Получить всех участников чата ---
/**
 * @route GET /chats/:id/users
 * @desc Получить список всех участников чата
 * @params :id - ID чата
 */
router.get("/:id/users", async (req, res) => {
  const chatId = req.params.id;
  const requesterId = req.user.id;

  try {
    // 1. Проверяем, состоит ли запрашивающий в этом чате
    const memberCheck = await client.query(
      `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, requesterId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: "Вы не являетесь участником этого чата" });
    }

    // 2. Если состоит, получаем всех участников
    const membersRes = await client.query(
      `SELECT u.id, u.username, u.avatar_url, cu.invited_by_user_id
       FROM users u
       JOIN chat_users cu ON u.id = cu.user_id
       WHERE cu.chat_id = $1`,
      [chatId]
    );

    res.json(membersRes.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера при получении участников чата" });
  }
});

// --- НОВЫЙ МАРШРУТ: Получить/создать код приглашения ---
/**
 * @route POST /chats/:id/invite-code
 * @desc Участник чата получает или генерирует новый код приглашения
 * @params :id - ID чата
 */
router.post("/:id/invite-code", async (req, res) => {
  const chatId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. Проверить, что пользователь состоит в чате
    const memberCheck = await client.query(
      `SELECT c.is_group, c.invite_code FROM chat_users cu
       JOIN chats c ON cu.chat_id = c.id
       WHERE cu.chat_id = $1 AND cu.user_id = $2`,
      [chatId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: "Вы не являетесь участником этого чата" });
    }
    
    const chat = memberCheck.rows[0];

    // 2. Проверить, что это групповой чат
    if (!chat.is_group) {
       return res.status(400).json({ message: "Нельзя создать приглашение для личного чата" });
    }

    // 3. Если код уже есть, вернуть его
    if (chat.invite_code) {
      return res.json({ inviteCode: chat.invite_code });
    }

    // 4. Если кода нет, сгенерировать, сохранить и вернуть
    let newCode = null;
    let attempts = 0;
    while (newCode === null && attempts < 5) { // 5 попыток на случай коллизии
      try {
        const code = crypto.randomBytes(4).toString('hex'); // 8 hex-символов
        await client.query(
          `UPDATE chats SET invite_code = $1 WHERE id = $2`,
          [code, chatId]
        );
        newCode = code;
      } catch (e) {
        // Ошибка unique constraint (коллизия)
        console.warn("Invite code collision, retrying...");
        attempts++;
      }
    }
    
    if (!newCode) {
       return res.status(500).json({ message: "Не удалось сгенерировать код приглашения" });
    }

    res.status(201).json({ inviteCode: newCode });

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// --- НОВЫЙ МАРШРУТ: Присоединиться к чату по коду ---
/**
 * @route POST /chats/join
 * @desc Присоединиться к групповому чату по коду
 * @body { inviteCode: string }
 */
router.post("/join", async (req, res) => {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    if (!inviteCode) {
        return res.status(400).json({ message: "Код приглашения не предоставлен" });
    }

    try {
        // 1. Найти чат по коду
        const chatRes = await client.query(
            `SELECT id, name, is_group, creator_id FROM chats WHERE invite_code = $1 AND is_group = true`,
            [inviteCode]
        );

        if (chatRes.rows.length === 0) {
            return res.status(404).json({ message: "Неверный код приглашения" });
        }
        
        const chat = chatRes.rows[0];
        const chatId = chat.id;
        const creatorId = chat.creator_id; // Используем создателя как "пригласившего"

        // 2. Проверить, не состоит ли пользователь уже в чате
        const alreadyExists = await client.query(
            `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
            [chatId, userId]
        );
        if (alreadyExists.rows.length > 0) {
            return res.status(400).json({ message: "Вы уже состоите в этом чате" });
        }

        // 3. Добавить пользователя в чат. 
        // Пригласившим (invited_by_user_id) указываем создателя чата.
        await client.query(
            `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`,
            [chatId, userId, creatorId]
        );

        // 4. Вернуть данные чата, чтобы фронтенд мог его открыть
        res.status(201).json(chat);

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Ошибка сервера при входе в чат" });
    }
});


// --- МАРШРУТЫ УПРАВЛЕНИЯ ГРУППОЙ (из прошлого шага) ---

/**
 * @route POST /chats/group
 * @desc Создать новую групповую комнату (чат)
 * @body { name: string }
 */
router.post("/group", async (req, res) => {
  const { name } = req.body;
  const creatorId = req.user.id;

  if (!name || name.trim() === "") {
    return res.status(400).json({ message: "Название комнаты не может быть пустым" });
  }

  try {
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
    console.error(e);
    res.status(500).json({ message: "Ошибка при создании комнаты" });
  }
});

/**
 * @route POST /chats/:id/invite
 * @desc Пригласить друга в комнату
 * @params :id - ID чата
 * @body { friendId: number } - ID пользователя, которого приглашают
 */
router.post("/:id/invite", async (req, res) => {
  const chatId = req.params.id;
  const inviterId = req.user.id;
  const { friendId } = req.body; 

  if (!friendId) {
    return res.status(400).json({ message: "Не указан ID пользователя для приглашения" });
  }

  try {
    const memberCheck = await client.query(
      `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, inviterId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: "Вы не являетесь участником этого чата" });
    }
    
    const alreadyExists = await client.query(
      `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, friendId]
    );
    if (alreadyExists.rows.length > 0) {
      return res.status(400).json({ message: "Пользователь уже в чате" });
    }

    await client.query(
      `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`,
      [chatId, friendId, inviterId]
    );

    res.json({ message: "Пользователь добавлен в комнату" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка при приглашении" });
  }
});

/**
 * @route POST /chats/:id/kick
 * @desc Удалить/кикнуть пользователя из комнаты (или выйти самому)
 * @params :id - ID чата
 * @body { userIdToKick: number } - ID пользователя, которого удаляют
 */
router.post("/:id/kick", async (req, res) => {
  const chatId = req.params.id;
  const kickerId = req.user.id; // Тот, кто удаляет
  const { userIdToKick } = req.body; // Тот, кого удаляют

  if (!userIdToKick) {
    return res.status(400).json({ message: "Не указан ID пользователя для удаления" });
  }

  try {
    const chatRes = await client.query(
      `SELECT creator_id FROM chats WHERE id = $1`,
      [chatId]
    );
    if (chatRes.rows.length === 0) {
      return res.status(404).json({ message: "Чат не найден" });
    }
    const isCreator = chatRes.rows[0].creator_id === kickerId;

    const memberRes = await client.query(
      `SELECT invited_by_user_id FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userIdToKick]
    );
    if (memberRes.rows.length === 0) {
      return res.status(404).json({ message: "Пользователь не найден в этом чате" });
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
        return res.status(403).json({ message: "У вас нет прав на удаление этого пользователя" });
    }

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});


// --- СТАРЫЕ МАРШРУТЫ (без изменений) ---

// Получить все чаты пользователя
router.get("/", async (req, res) => {
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
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера при получении чатов" });
  }
});

// Получить сообщения чата
router.get("/:id/messages", async (req, res) => {
  const chatId = req.params.id;
  const userId = req.user.id;

  try {
    const result = await client.query(
      `SELECT m.id, m.text, m.created_at, u.id as sender_id, u.username as sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.chat_id = $1
         AND NOT m.deleted_for @> ARRAY[$2]::int[]
       ORDER BY m.created_at ASC`,
      [chatId, userId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера при получении сообщений" });
  }
});

// Отправить сообщение
router.post("/:id/messages", async (req, res) => {
  const chatId = req.params.id;
  const senderId = req.user.id;
  const { text } = req.body;

  try {
    const chatExists = await client.query(
      "SELECT id FROM chats WHERE id = $1",
      [chatId]
    );
    if (chatExists.rows.length === 0) {
      return res.status(400).json({ message: "Чат не найден" });
    }

    // Возвращаем сообщение в том же формате, что и GET /:id/messages
    const result = await client.query(
      `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) RETURNING id, text, created_at, sender_id`,
      [chatId, senderId, text]
    );
    
    // Дополняем информацией о пользователе
    const newMessage = result.rows[0];
    newMessage.sender_name = req.user.username; // req.user берется из authMiddleware

    res.json(newMessage);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера при отправке сообщения" });
  }
});

// Создать или получить приватный чат между двумя пользователями
router.post("/private", async (req, res) => {
  const userId = req.user.id;
  const { friendId } = req.body;

  try {
    const existingChat = await client.query(
      `SELECT c.id
       FROM chats c
       JOIN chat_users cu1 ON cu1.chat_id = c.id
       JOIN chat_users cu2 ON cu2.chat_id = c.id
       WHERE c.is_group = false AND cu1.user_id = $1 AND cu2.user_id = $2`,
      [userId, friendId]
    );

    if (existingChat.rows.length > 0) {
      return res.json(existingChat.rows[0]); // возвращаем id существующего чата
    }

    const newChat = await client.query(
      `INSERT INTO chats (name, is_group, creator_id) VALUES ('', false, $1) RETURNING id`,
      [userId] // Указываем создателя
    );

    const chatId = newChat.rows[0].id;

    // Добавляем участников, указывая, кто пригласил
    await client.query(
      `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $2), ($1, $3, $2)`,
      [chatId, userId, friendId]
    );

    res.json({ id: chatId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера при создании чата" });
  }
});

module.exports = router;