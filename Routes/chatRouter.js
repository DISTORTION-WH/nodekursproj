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
    const check = await client.query(`SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`, [chatId, requesterId]);
    if (check.rows.length === 0) return res.status(403).json({message: "Нет доступа"});
    const resDb = await client.query(
      `SELECT u.id, u.username, u.avatar_url, cu.invited_by_user_id
       FROM users u JOIN chat_users cu ON u.id = cu.user_id WHERE cu.chat_id = $1`, [chatId]);
    res.json(resDb.rows);
  } catch (e) { next(e); }
});

router.post("/:id/invite-code", async (req, res, next) => {
  const chatId = req.params.id;
  try {
    const chat = (await client.query(`SELECT * FROM chats WHERE id = $1`, [chatId])).rows[0];
    if (!chat?.is_group) return res.status(400).json({message: "Только для групп"});
    if (chat.invite_code) return res.json({ inviteCode: chat.invite_code });
    const code = crypto.randomBytes(4).toString('hex');
    await client.query(`UPDATE chats SET invite_code = $1 WHERE id = $2`, [code, chatId]);
    res.status(201).json({ inviteCode: code });
  } catch (e) { next(e); }
});

router.post("/join", async (req, res, next) => {
  const { inviteCode } = req.body;
  const userId = req.user.id;
  try {
    const chatRes = await client.query(`SELECT * FROM chats WHERE invite_code = $1`, [inviteCode]);
    if (chatRes.rows.length === 0) return res.status(404).json({message: "Неверный код"});
    const chat = chatRes.rows[0];
    const check = await client.query(`SELECT 1 FROM chat_users WHERE chat_id=$1 AND user_id=$2`, [chat.id, userId]);
    if (check.rows.length > 0) return res.status(400).json({message: "Вы уже в чате"});
    await client.query(`INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`, [chat.id, userId, chat.creator_id]);
    
    // 🔔 Уведомляем чат о новом участнике
    req.app.get('io').to(`chat_${chat.id}`).emit('chat_member_updated', { chatId: chat.id });
    res.status(201).json(chat);
  } catch (e) { next(e); }
});

router.post("/group", async (req, res, next) => {
  const { name } = req.body;
  const creatorId = req.user.id;
  try {
    const newChat = (await client.query(`INSERT INTO chats (name, is_group, creator_id) VALUES ($1, true, $2) RETURNING *`, [name, creatorId])).rows[0];
    await client.query(`INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $2)`, [newChat.id, creatorId]);
    res.status(201).json(newChat);
  } catch (e) { next(e); }
});

router.post("/:id/invite", async (req, res, next) => {
  const chatId = req.params.id;
  const inviterId = req.user.id;
  const { friendId } = req.body;
  try {
    await client.query(`INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`, [chatId, friendId, inviterId]);
    req.app.get('io').to(`user_${friendId}`).emit('added_to_chat', { chatId });
    req.app.get('io').to(`chat_${chatId}`).emit('chat_member_updated', { chatId });
    res.json({ message: "Приглашен" });
  } catch (e) { next(e); }
});

router.post("/:id/kick", async (req, res, next) => {
  const chatId = req.params.id;
  const { userIdToKick } = req.body;
  try {
    await client.query(`DELETE FROM chat_users WHERE chat_id=$1 AND user_id=$2`, [chatId, userIdToKick]);
    req.app.get('io').to(`user_${userIdToKick}`).emit('removed_from_chat', { chatId });
    req.app.get('io').to(`chat_${chatId}`).emit('chat_member_updated', { chatId });
    res.json({ message: "Удален из комнаты" });
  } catch (e) { next(e); }
});

router.get("/", async (req, res, next) => {
  const userId = req.user.id;
  try {
    const result = await client.query(
      `SELECT c.id, c.name, c.is_group, c.creator_id FROM chats c
       JOIN chat_users cu ON cu.chat_id = c.id WHERE cu.user_id = $1`, [userId]);
    res.json(result.rows);
  } catch (e) { next(e); }
});

router.get("/:id/messages", async (req, res, next) => {
  const chatId = req.params.id;
  const userId = req.user.id;
  try {
    const result = await client.query(
      `SELECT m.id, m.text, m.created_at, m.chat_id, u.id as sender_id, u.username as sender_name
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.chat_id = $1 AND NOT m.deleted_for @> ARRAY[$2]::int[]
       ORDER BY m.created_at ASC`, [chatId, userId]);
    res.json(result.rows);
  } catch (e) { next(e); }
});

router.post("/:id/messages", async (req, res, next) => {
  const chatId = req.params.id;
  const senderId = req.user.id;
  const { text } = req.body;
  try {
    const result = await client.query(
      `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) 
       RETURNING id, text, created_at, sender_id, chat_id`, [chatId, senderId, text]);
    const msg = result.rows[0];
    msg.sender_name = req.user.username;
    req.app.get('io').to(`chat_${chatId}`).emit('new_message', msg);
    res.json(msg);
  } catch (e) { next(e); }
});

router.post("/private", async (req, res, next) => {
  const userId = req.user.id;
  const { friendId } = req.body;
  try {
    const exist = await client.query(
      `SELECT c.id FROM chats c JOIN chat_users cu1 ON cu1.chat_id = c.id JOIN chat_users cu2 ON cu2.chat_id = c.id
       WHERE c.is_group = false AND cu1.user_id = $1 AND cu2.user_id = $2`, [userId, friendId]);
    if (exist.rows.length > 0) return res.json(exist.rows[0]);

    const newChat = (await client.query(`INSERT INTO chats (name, is_group, creator_id) VALUES ('', false, $1) RETURNING id`, [userId])).rows[0];
    await client.query(`INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $2), ($1, $3, $2)`, [newChat.id, userId, friendId]);
    res.json({ id: newChat.id });
  } catch (e) { next(e); }
});

module.exports = router;