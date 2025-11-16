const client = require("../databasepg");
const crypto = require("crypto");

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
    throw err;
  }
}

async function deleteMessagesByChat(chatId) {
  try {
    return await client.query(`DELETE FROM messages WHERE chat_id = $1`, [
      chatId,
    ]);
  } catch (err) {
    console.error(
      `[ChatService] Ошибка deleteMessagesByChat (${chatId}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function deleteChatUsers(chatId) {
  try {
    return await client.query(`DELETE FROM chat_users WHERE chat_id = $1`, [
      chatId,
    ]);
  } catch (err) {
    console.error(
      `[ChatService] Ошибка deleteChatUsers (${chatId}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function deleteChat(chatId) {
  try {
    return await client.query(`DELETE FROM chats WHERE id = $1`, [chatId]);
  } catch (err) {
    console.error(
      `[ChatService] Ошибка deleteChat (${chatId}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function deleteChatAndData(chatId) {
  const connection = await client.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("DELETE FROM messages WHERE chat_id = $1", [chatId]);
    await connection.query("DELETE FROM chat_users WHERE chat_id = $1", [
      chatId,
    ]);
    await connection.query("DELETE FROM chats WHERE id = $1", [chatId]);
    await connection.query("COMMIT");
  } catch (e) {
    await connection.query("ROLLBACK");
    console.error(
      `[ChatService] Ошибка в транзакции deleteChatAndData (${chatId}):`,
      e
    );
    throw e;
  } finally {
    connection.release();
  }
}

async function getChatUsers(chatId, requesterId) {
  const check = await client.query(
    `SELECT 1 FROM chat_users WHERE chat_id = $1 AND user_id = $2`,
    [chatId, requesterId]
  );
  if (check.rows.length === 0) {
    const err = new Error("Нет доступа к этому чату");
    err.status = 403;
    throw err;
  }

  const resDb = await client.query(
    `SELECT u.id, u.username, u.avatar_url, cu.invited_by_user_id
     FROM users u JOIN chat_users cu ON u.id = cu.user_id WHERE cu.chat_id = $1`,
    [chatId]
  );
  return resDb.rows;
}

async function createInviteCode(chatId) {
  const chat = (
    await client.query(`SELECT * FROM chats WHERE id = $1`, [chatId])
  ).rows[0];
  if (!chat) {
    const err = new Error("Чат не найден");
    err.status = 404;
    throw err;
  }
  if (!chat.is_group) {
    const err = new Error("Приглашать можно только в группы");
    err.status = 400;
    throw err;
  }

  if (chat.invite_code) return chat.invite_code;

  const code = crypto.randomBytes(4).toString("hex");
  await client.query(`UPDATE chats SET invite_code = $1 WHERE id = $2`, [
    code,
    chatId,
  ]);
  return code;
}

async function joinWithInviteCode(inviteCode, userId) {
  const chatRes = await client.query(
    `SELECT * FROM chats WHERE invite_code = $1`,
    [inviteCode]
  );
  if (chatRes.rows.length === 0) {
    const err = new Error("Неверный код приглашения");
    err.status = 404;
    throw err;
  }
  const chat = chatRes.rows[0];

  const check = await client.query(
    `SELECT 1 FROM chat_users WHERE chat_id=$1 AND user_id=$2`,
    [chat.id, userId]
  );
  if (check.rows.length > 0) {
    const err = new Error("Вы уже состоите в этом чате");
    err.status = 400;
    throw err;
  }

  await client.query(
    `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`,
    [chat.id, userId, chat.creator_id]
  );
  return chat;
}

async function createGroupChat(name, creatorId) {
  const newChat = (
    await client.query(
      `INSERT INTO chats (name, is_group, creator_id) VALUES ($1, true, $2) RETURNING *`,
      [name, creatorId]
    )
  ).rows[0];

  await client.query(
    `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $2)`,
    [newChat.id, creatorId]
  );
  return newChat;
}

async function inviteToGroup(chatId, friendId, inviterId) {
  await client.query(
    `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $3)`,
    [chatId, friendId, inviterId]
  );
}

async function kickFromGroup(chatId, userIdToKick) {
  await client.query(`DELETE FROM chat_users WHERE chat_id=$1 AND user_id=$2`, [
    chatId,
    userIdToKick,
  ]);
}

async function getAllUserChats(userId) {
  const result = await client.query(
    `SELECT c.id, c.name, c.is_group, c.creator_id FROM chats c
     JOIN chat_users cu ON cu.chat_id = c.id WHERE cu.user_id = $1`,
    [userId]
  );
  return result.rows;
}

async function getChatMessages(chatId, userId) {
  const result = await client.query(
    `SELECT m.id, m.text, m.created_at, m.chat_id, u.id as sender_id, u.username as sender_name
     FROM messages m JOIN users u ON m.sender_id = u.id
     WHERE m.chat_id = $1 AND NOT m.deleted_for @> ARRAY[$2]::int[]
     ORDER BY m.created_at ASC`,
    [chatId, userId]
  );
  return result.rows;
}

async function postMessage(chatId, senderId, text) {
  const result = await client.query(
    `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) 
     RETURNING id, text, created_at, sender_id, chat_id`,
    [chatId, senderId, text]
  );
  return result.rows[0];
}

async function findOrCreatePrivateChat(userId, friendId) {
  const exist = await client.query(
    `SELECT c.id FROM chats c JOIN chat_users cu1 ON cu1.chat_id = c.id JOIN chat_users cu2 ON cu2.chat_id = c.id
     WHERE c.is_group = false AND cu1.user_id = $1 AND cu2.user_id = $2`,
    [userId, friendId]
  );
  if (exist.rows.length > 0) return exist.rows[0];

  const newChat = (
    await client.query(
      `INSERT INTO chats (name, is_group, creator_id) VALUES ('', false, $1) RETURNING id`,
      [userId]
    )
  ).rows[0];

  await client.query(
    `INSERT INTO chat_users (chat_id, user_id, invited_by_user_id) VALUES ($1, $2, $2), ($1, $3, $2)`,
    [newChat.id, userId, friendId]
  );
  return { id: newChat.id };
}

async function deleteMessages(chatId, userId, allForEveryone) {
  if (allForEveryone) {
    await client.query("DELETE FROM messages WHERE chat_id = $1", [chatId]);
  } else {
    await client.query(
      `UPDATE messages SET deleted_for = array_append(deleted_for, $1)
       WHERE chat_id = $2 AND NOT deleted_for @> ARRAY[$1]::int[]`,
      [userId, chatId]
    );
  }
}

module.exports = {
  getAllChats,
  deleteMessagesByChat,
  deleteChatUsers,
  deleteChat,
  deleteChatAndData,
  getChatUsers,
  createInviteCode,
  joinWithInviteCode,
  createGroupChat,
  inviteToGroup,
  kickFromGroup,
  getAllUserChats,
  getChatMessages,
  postMessage,
  findOrCreatePrivateChat,
  deleteMessages,
};
