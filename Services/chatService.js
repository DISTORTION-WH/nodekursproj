const client = require("../databasepg");

// Получить все чаты с участниками и сообщениями
async function getAllChats() {
  try {
    const chatsRes = await client.query(`
      SELECT c.id, c.name, c.is_group,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', u.id,
              'username', u.username
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS participants
      FROM chats c
      LEFT JOIN chat_users cu ON cu.chat_id = c.id
      LEFT JOIN users u ON u.id = cu.user_id
      GROUP BY c.id
      ORDER BY c.id
    `);

    const chats = chatsRes.rows;

    // Этот цикл также должен быть внутри try...catch
    for (let chat of chats) {
      const messagesRes = await client.query(
        `SELECT m.id, m.text, m.created_at,
                json_build_object('id', u.id, 'username', u.username) as sender
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.chat_id = $1
         ORDER BY m.created_at ASC`,
        [chat.id]
      );
      chat.messages = messagesRes.rows;
    }

    return chats;
  } catch (err) {
    console.error(`[ChatService] Ошибка getAllChats:`, err.message, err.stack);
    throw err; // Пробрасываем ошибку для контроллера
  }
}

// Удалить сообщения чата
async function deleteMessagesByChat(chatId) {
  try {
    return await client.query(`DELETE FROM messages WHERE chat_id = $1`, [chatId]);
  } catch (err) {
    console.error(`[ChatService] Ошибка deleteMessagesByChat (${chatId}):`, err.message, err.stack);
    throw err;
  }
}

// Удалить связи пользователей с чатом
async function deleteChatUsers(chatId) {
  try {
    return await client.query(`DELETE FROM chat_users WHERE chat_id = $1`, [chatId]);
  } catch (err) {
    console.error(`[ChatService] Ошибка deleteChatUsers (${chatId}):`, err.message, err.stack);
    throw err;
  }
}

// Удалить сам чат
async function deleteChat(chatId) {
  try {
    return await client.query(`DELETE FROM chats WHERE id = $1`, [chatId]);
  } catch (err) {
    console.error(`[ChatService] Ошибка deleteChat (${chatId}):`, err.message, err.stack);
    throw err;
  }
}

module.exports = {
  getAllChats,
  deleteMessagesByChat,
  deleteChatUsers,
  deleteChat
};