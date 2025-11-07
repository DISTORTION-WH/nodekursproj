const client = require("../databasepg");
const bcrypt = require("bcryptjs");

async function findUserByUsername(username) {
  try {
    const result = await client.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    return result.rows[0];
  } catch (err) {
    console.error(
      `[UserService] Ошибка findUserByUsername (${username}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function createUser(
  username,
  password,
  roleId,
  avatarUrl = null,
  email = null
) {
  try {
    let hashed = password;
    if (!hashed || typeof hashed !== "string") {
      throw new Error("Password must be a string");
    }

    if (!hashed.startsWith("$2")) {
      const saltRounds = 10;
      hashed = await bcrypt.hash(hashed, saltRounds);
    }

    const result = await client.query(
      `INSERT INTO users (username, password, role_id, avatar_url, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, avatar_url, role_id, created_at, email`,
      [username, hashed, roleId, avatarUrl, email]
    );

    return result.rows[0];
  } catch (err) {
    console.error(
      `[UserService] Ошибка createUser (${username}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function getAllUsers() {
  try {
    const result = await client.query(`
      SELECT u.id, u.username, u.password, u.avatar_url, r.value as role, u.email, u.created_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
    `);
    return result.rows;
  } catch (err) {
    console.error(`[UserService] Ошибка getAllUsers:`, err.message, err.stack);
    throw err;
  }
}

async function getUserById(id) {
  try {
    const userResult = await client.query(
      `SELECT u.id, u.username, u.avatar_url, u.created_at, r.value as role, u.email
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) return null;
    const user = userResult.rows[0];

    const friendsResult = await client.query(
      `SELECT u.id, u.username, u.avatar_url
       FROM users u
       JOIN friends f
         ON (u.id = f.friend_id OR u.id = f.user_id)
       WHERE (f.user_id = $1 OR f.friend_id = $1)
         AND f.status = 'accepted'
         AND u.id != $1`,
      [id]
    );

    user.friends = friendsResult.rows || [];
    return user;
  } catch (err) {
    console.error(
      `[UserService] Ошибка getUserById (${id}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function changeUserPassword(userId, oldPassword, newPassword) {
  try {
    const userRes = await client.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );
    if (userRes.rows.length === 0) throw new Error("Пользователь не найден");

    const isValid = await bcrypt.compare(oldPassword, userRes.rows[0].password);
    if (!isValid) throw new Error("Старый пароль неверный");

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await client.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedNew,
      userId,
    ]);
  } catch (err) {
    console.error(
      `[UserService] Ошибка changeUserPassword (${userId}):`,
      err.message
    );
    throw err;
  }
}

async function updateUserAvatar(userId, avatarUrl) {
  try {
    await client.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [
      avatarUrl,
      userId,
    ]);

    const res = await client.query(
      `SELECT u.id, u.username, u.avatar_url, u.created_at, r.value as role, u.email
       FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [userId]
    );
    return res.rows[0];
  } catch (err) {
    console.error(
      `[UserService] Ошибка updateUserAvatar (${userId}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function saveRegistrationCode(
  email,
  username,
  password,
  avatarUrl,
  code
) {
  try {
    await client.query(
      `INSERT INTO registration_codes (email, username, password, avatar_url, code)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET username = $2, password = $3, avatar_url = $4, code = $5, created_at = NOW()`,
      [email, username, password, avatarUrl, code]
    );
  } catch (err) {
    console.error(
      `[UserService] Ошибка saveRegistrationCode (${email}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function getRegistrationCode(email) {
  try {
    const res = await client.query(
      "SELECT * FROM registration_codes WHERE email = $1",
      [email]
    );
    return res.rows[0];
  } catch (err) {
    console.error(
      `[UserService] Ошибка getRegistrationCode (${email}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function deleteRegistrationCode(email) {
  try {
    await client.query("DELETE FROM registration_codes WHERE email = $1", [
      email,
    ]);
  } catch (err) {
    console.error(
      `[UserService] Ошибка deleteRegistrationCode (${email}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function updateUser(userId, { username, roleId, email }) {
  try {
    const res = await client.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           role_id = COALESCE($2, role_id),
           email = COALESCE($3, email)
       WHERE id = $4
       RETURNING id, username, email, role_id, avatar_url, created_at`,
      [username, roleId, email, userId]
    );
    return res.rows[0];
  } catch (err) {
    console.error(
      `[UserService] Ошибка updateUser (${userId}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function deleteUser(userId) {
  try {
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
  } catch (err) {
    console.error(
      `[UserService] Ошибка deleteUser (${userId}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function searchUsers(query) {
  try {
    const res = await client.query(
      `SELECT u.id, u.username, u.email, u.avatar_url, r.value as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.username ILIKE $1 OR u.email ILIKE $1`,
      [`%${query}%`]
    );
    return res.rows;
  } catch (err) {
    console.error(
      `[UserService] Ошибка searchUsers (${query}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

module.exports = {
  findUserByUsername,
  createUser,
  getAllUsers,
  getUserById,
  updateUserAvatar,
  saveRegistrationCode,
  getRegistrationCode,
  deleteRegistrationCode,
  changeUserPassword,
  updateUser,
  deleteUser,
  searchUsers,
};
