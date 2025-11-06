// Routes/friendsRouter.js
const Router = require("express");
const router = new Router();
const client = require("../databasepg");
const authMiddleware = require("../middleware/authMiddleware");

// Получить список друзей
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
  } catch (err) {
    console.error("❗️ Ошибка в GET /friends:", err.message, err.stack);
    next(err); 
  }
});

// Отправить запрос в друзья
router.post("/request", authMiddleware, async (req, res, next) => {
  const userId = req.user.id;
  const { friendId } = req.body;

  try {
    if (isNaN(parseInt(friendId, 10))) {
      const err = new Error("Неверный ID друга");
      err.status = 400; // Bad Request
      throw err;
    }

    await client.query(
      `INSERT INTO friends (user_id, friend_id, status)
       VALUES ($1, $2, 'pending')`,
      [userId, friendId]
    );

    // --- 🆕 SOCKET.IO УВЕДОМЛЕНИЕ ---
    const io = req.app.get('io');
    io.to(`user_${friendId}`).emit('new_friend_request', {
        fromUserId: userId,
        message: "Вам пришел новый запрос в друзья!"
    });
    // --------------------------------

    res.json({ message: "Запрос на дружбу отправлен" });
  } catch (err) {
    console.error("❗️ Ошибка в POST /friends/request:", err.message, err.stack);
    if (err.code === '23505') { // unique_violation
        err.status = 409; 
        err.message = "Запрос уже отправлен или вы уже друзья.";
    }
    next(err);
  }
});

// Принять запрос
router.post("/accept", authMiddleware, async (req, res, next) => {
  const userId = req.user.id; 
  const { friendId } = req.body; 
  
  try {
    if (isNaN(parseInt(friendId, 10))) {
      const err = new Error("Неверный ID друга");
      err.status = 400; 
      throw err;
    }
    
    await client.query(
      `UPDATE friends
       SET status='accepted'
       WHERE user_id=$1 AND friend_id=$2 AND status='pending'`,
      [friendId, userId]
    );
    res.json({ message: "Запрос принят, теперь вы друзья" });
  } catch (e) {
    console.error("❗️ Ошибка в POST /friends/accept:", e.message, e.stack);
    next(e);
  }
});

// Удалить друга
router.post("/remove", authMiddleware, async (req, res, next) => {
  const userId = req.user.id;
  const { friendId } = req.body;

  try {
    if (isNaN(parseInt(friendId, 10))) {
      const err = new Error("Неверный ID друга");
      err.status = 400; 
      throw err;
    }

    await client.query(
      `DELETE FROM friends
       WHERE (user_id=$1 AND friend_id=$2)
          OR (user_id=$2 AND friend_id=$1)`,
      [userId, friendId]
    );
    res.json({ message: "Друг удалён" });
  } catch (err) {
     console.error("❗️ Ошибка в POST /friends/remove:", err.message, err.stack);
     next(err);
  }
});

// Получить все входящие запросы
router.get("/incoming", authMiddleware, async (req, res, next) => {
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
    console.error("❗️ Ошибка в GET /friends/incoming:", e.message, e.stack);
    next(e);
  }
});

module.exports = router;