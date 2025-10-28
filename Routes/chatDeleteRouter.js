const Router = require("express");
const router = new Router();
const client = require("../databasepg");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

/**
 * Удаление сообщений
 * body: { allForEveryone: boolean }
 * - если allForEveryone=true -> удаляем все сообщения чата
 * - если allForEveryone=false -> удаляем только у текущего пользователя
 */
router.post("/:id/messages/delete", async (req, res) => {
  const chatId = req.params.id;
  const userId = req.user.id;
  const { allForEveryone } = req.body;

  try {
    if (allForEveryone) {
      // Удаляем все сообщения для всех участников
      await client.query(
        "DELETE FROM messages WHERE chat_id = $1",
        [chatId]
      );
    } else {
      // Удаляем сообщения только для текущего пользователя
      await client.query(
        `UPDATE messages
         SET deleted_for = array_append(deleted_for, $1)
         WHERE chat_id = $2
           AND NOT deleted_for @> ARRAY[$1]::int[]`,
        [userId, chatId]
      );
    }

    res.json({ message: "Сообщения удалены" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Ошибка сервера при удалении сообщений" });
  }
});

module.exports = router;
