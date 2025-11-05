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
// 1. Добавлен 'next' в параметры
router.post("/:id/messages/delete", async (req, res, next) => {
  const chatId = req.params.id;
  const userId = req.user.id;
  const { allForEveryone } = req.body;

  try {
    // 2. Добавлена валидация ID чата
    if (isNaN(parseInt(chatId, 10))) {
      const err = new Error("Неверный ID чата");
      err.status = 400; // Bad Request
      throw err;
    }

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
    // 3. Блок catch теперь логирует и передает ошибку дальше
    console.error(`❗️ Ошибка в POST /${chatId}/messages/delete:`, e.message, e.stack);
    next(e); // Передаем ошибку в глобальный обработчик
  }
});

module.exports = router;