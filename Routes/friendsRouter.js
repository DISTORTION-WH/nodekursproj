// Routes/friendsRouter.js
const Router = require("express");
const router = new Router();
const client = require("../databasepg");
const authMiddleware = require("../middleware/authMiddleware");

// Получить список друзей
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await client.query(
      `SELECT u.id, u.username, u.avatar_url
       FROM users u
       JOIN friends f ON (u.id = f.friend_id OR u.id = f.user_id)
       WHERE (f.user_id = $1 OR f.friend_id = $1)
         AND f.status='accepted'
         AND u.id != $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Отправить запрос в друзья
router.post("/request", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { friendId } = req.body;
  await client.query(
    `INSERT INTO friends (user_id, friend_id, status)
     VALUES ($1, $2, 'pending')`,
    [userId, friendId]
  );
  res.json({ message: "Запрос на дружбу отправлен" });
});

// Принять запрос
router.post("/accept", authMiddleware, async (req, res) => {
  const userId = req.user.id; // тот, кто принимает
  const { friendId } = req.body; // id того, кто отправил запрос
  try {
    await client.query(
      `UPDATE friends
       SET status='accepted'
       WHERE user_id=$1 AND friend_id=$2 AND status='pending'`,
      [friendId, userId]
    );
    res.json({ message: "Запрос принят, теперь вы друзья" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Удалить друга
router.post("/remove", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { friendId } = req.body;
  await client.query(
    `DELETE FROM friends
     WHERE (user_id=$1 AND friend_id=$2)
        OR (user_id=$2 AND friend_id=$1)`,
    [userId, friendId]
  );
  res.json({ message: "Друг удалён" });
});

// Получить все входящие запросы
router.get("/incoming", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await client.query(
      `SELECT f.user_id as requester_id,
              u.username as requester_name,
              u.avatar_url as requester_avatar
       FROM friends f
       JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

module.exports = router;
