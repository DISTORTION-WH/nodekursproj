const Router = require("express");
const router = new Router();
const client = require("../databasepg");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.post("/:id/messages/delete", async (req, res, next) => {
  const chatId = req.params.id;
  const userId = req.user.id;
  const { allForEveryone } = req.body;

  try {
    if (allForEveryone) {
      await client.query("DELETE FROM messages WHERE chat_id = $1", [chatId]);
      // 🔔 Уведомляем всех в чате, что сообщения удалены
      req.app.get('io').to(`chat_${chatId}`).emit('messages_cleared', { chatId });
    } else {
      await client.query(
        `UPDATE messages SET deleted_for = array_append(deleted_for, $1)
         WHERE chat_id = $2 AND NOT deleted_for @> ARRAY[$1]::int[]`,
        [userId, chatId]
      );
    }
    res.json({ message: "Сообщения удалены" });
  } catch (e) { next(e); }
});

module.exports = router;