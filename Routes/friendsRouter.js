const Router = require("express");
const router = new Router();
const client = require("../databasepg");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, async (req, res, next) => {
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
  } catch (err) { next(err); }
});

router.post("/request", authMiddleware, async (req, res, next) => {
  const userId = req.user.id;
  const { friendId } = req.body;
  try {
    await client.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending')`,
      [userId, friendId]
    );
    // 🔔 Уведомляем получателя о новом запросе
    req.app.get('io').to(`user_${friendId}`).emit('new_friend_request');
    res.json({ message: "Запрос отправлен" });
  } catch (err) {
    if (err.code === '23505') { 
        err.status = 409; 
        err.message = "Запрос уже отправлен или вы уже друзья.";
    }
    next(err);
  }
});

router.post("/accept", authMiddleware, async (req, res, next) => {
  const userId = req.user.id; 
  const { friendId } = req.body; 
  try {
    await client.query(
      `UPDATE friends SET status='accepted'
       WHERE user_id=$1 AND friend_id=$2 AND status='pending'`,
      [friendId, userId]
    );
    // 🔔 Уведомляем отправителя запроса (friendId), что userId его принял
    req.app.get('io').to(`user_${friendId}`).emit('friend_request_accepted');
    res.json({ message: "Запрос принят" });
  } catch (e) { next(e); }
});

router.post("/remove", authMiddleware, async (req, res, next) => {
  const userId = req.user.id;
  const { friendId } = req.body;
  try {
    await client.query(
      `DELETE FROM friends
       WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)`,
      [userId, friendId]
    );
    // 🔔 Уведомляем бывшего друга об удалении
    req.app.get('io').to(`user_${friendId}`).emit('friend_removed', { byUserId: userId });
    res.json({ message: "Друг удалён" });
  } catch (err) { next(err); }
});

router.get("/incoming", authMiddleware, async (req, res, next) => {
  const userId = req.user.id;
  try {
    const result = await client.query(
      `SELECT f.user_id as requester_id, u.username as requester_name, u.avatar_url as requester_avatar
       FROM friends f JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

module.exports = router;