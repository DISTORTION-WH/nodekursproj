const Router = require("express");
const router = new Router();
const client = require("../databasepg");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

/**
 * Удаление сообщений
 * body: { allForEveryone: boolean }
 */
router.post("/:id/messages/delete", async (req, res, next) => {
  const chatId = req.params.id;
  const userId = req.user.id;
  const { allForEveryone } = req.body;

  try {
    if (isNaN(parseInt(chatId, 10))) {
      const err = new Error("Неверный ID чата");
      err.status = 400; 
      throw err;
    }

    if (allForEveryone) {
      // Удаляем все сообщения для всех участников
      await client.query(
        "DELETE FROM messages WHERE chat_id = $1",
        [chatId]
      );
      
      // --- 🆕 SOCKET.IO: Уведомляем всех в чате об очистке истории ---
      const io = req.app.get('io');
      io.to(`chat_${chatId}`).emit('messages_cleared', { chatId, allForEveryone: true });
      // ---------------------------------------------------------------

    } else {
      // Удаляем сообщения только для текущего пользователя
      await client.query(
        `UPDATE messages
         SET deleted_for = array_append(deleted_for, $1)
         WHERE chat_id = $2
           AND NOT deleted_for @> ARRAY[$1]::int[]`,
        [userId, chatId]
      );
      
      // Здесь можно не отправлять общий сокет, или отправить только себе, 
      // но клиент и так знает, что он нажал кнопку.
    }

    res.json({ message: "Сообщения удалены" });
  } catch (e) {
    console.error(`❗️ Ошибка в POST /${chatId}/messages/delete:`, e.message, e.stack);
    next(e); 
  }
});

module.exports = router;