const Router = require("express");
const router = new Router();
const client = require("../databasepg");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Получить все чаты пользователя
router.get("/", async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await client.query(
      `SELECT c.id, c.name, c.is_group
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
    // Проверка: существует ли чат
    const chatExists = await client.query(
      "SELECT id FROM chats WHERE id = $1",
      [chatId]
    );
    if (chatExists.rows.length === 0) {
      return res.status(400).json({ message: "Чат не найден" });
    }

    const result = await client.query(
      `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *`,
      [chatId, senderId, text]
    );
    res.json(result.rows[0]);
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
    // Проверяем, есть ли уже чат между этими пользователями
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

    // Создаем новый приватный чат
    const newChat = await client.query(
      `INSERT INTO chats (name, is_group) VALUES ('', false) RETURNING id`
    );

    const chatId = newChat.rows[0].id;

    // Добавляем участников
    await client.query(
      `INSERT INTO chat_users (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [chatId, userId, friendId]
    );

    res.json({ id: chatId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера при создании чата" });
  }
});

module.exports = router;
