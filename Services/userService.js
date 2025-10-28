// Services/userService.js
const client = require("../databasepg");
const bcrypt = require("bcryptjs");

// Найти пользователя по username
async function findUserByUsername(username) {
  const result = await client.query(
    "SELECT * FROM users WHERE username = $1",
    [username]
  );
  return result.rows[0];
}

/**
 * Создать нового пользователя.
 * Если переданный `password` уже выглядит как bcrypt-хэш (начинается с $2),
 * то мы НЕ будем его хэшировать повторно.
 * Возвращаем созданного пользователя (id, username, avatar_url, role_id, created_at, email).
 *
 * Теперь принимает (username, password, roleId, avatarUrl = null, email = null)
 */
async function createUser(username, password, roleId, avatarUrl = null, email = null) {
  let hashed = password;
  if (!hashed || typeof hashed !== "string") {
    throw new Error("Password must be a string");
  }

  // если строка не начинается с $2 (bcrypt), то хэшируем
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
}

// Получить всех пользователей с их ролями и email
async function getAllUsers() {
  const result = await client.query(`
    SELECT u.id, u.username, u.password, u.avatar_url, r.value as role, u.email, u.created_at
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
  `);
  return result.rows;
}

/**
 * Получить пользователя по id с деталями:
 * - id, username, avatar_url, created_at, role (строка), email
 * - friends: массив {id, username, avatar_url}
 */
async function getUserById(id) {
  const userResult = await client.query(
    `SELECT u.id, u.username, u.avatar_url, u.created_at, r.value as role, u.email
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [id]
  );

  if (userResult.rows.length === 0) return null;
  const user = userResult.rows[0];

  // список друзей (accepted)
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
}

/**
 * Смена пароля:
 * - проверяем старый пароль,
 * - хэшируем новый и сохраняем.
 * Бросаем исключение с сообщением, если что-то не так.
 */
async function changeUserPassword(userId, oldPassword, newPassword) {
  const userRes = await client.query("SELECT password FROM users WHERE id = $1", [userId]);
  if (userRes.rows.length === 0) throw new Error("Пользователь не найден");

  const isValid = await bcrypt.compare(oldPassword, userRes.rows[0].password);
  if (!isValid) throw new Error("Старый пароль неверный");

  const hashedNew = await bcrypt.hash(newPassword, 10);
  await client.query("UPDATE users SET password = $1 WHERE id = $2", [hashedNew, userId]);
}

/**
 * Обновить аватар пользователя и вернуть обновлённого пользователя
 */
async function updateUserAvatar(userId, avatarUrl) {
  await client.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [avatarUrl, userId]);

  const res = await client.query(
    `SELECT u.id, u.username, u.avatar_url, u.created_at, r.value as role, u.email
     FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
    [userId]
  );
  return res.rows[0];
}

// ========== Новые функции для подтверждения email ==========

// Сохраняем код подтверждения для регистрации
async function saveRegistrationCode(email, username, password, avatarUrl, code) {
  await client.query(
    `INSERT INTO registration_codes (email, username, password, avatar_url, code)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE
       SET username = $2, password = $3, avatar_url = $4, code = $5, created_at = NOW()`,
    [email, username, password, avatarUrl, code]
  );
}

// Получаем данные по email (временные данные регистрации)
async function getRegistrationCode(email) {
  const res = await client.query(
    "SELECT * FROM registration_codes WHERE email = $1",
    [email]
  );
  return res.rows[0];
}

// Удаляем код после успешной регистрации
async function deleteRegistrationCode(email) {
  await client.query("DELETE FROM registration_codes WHERE email = $1", [email]);
}

// ========== Admin helpers we added earlier ==========
async function updateUser(userId, { username, roleId, email }) {
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
}

async function deleteUser(userId) {
  await client.query("DELETE FROM users WHERE id = $1", [userId]);
}

async function searchUsers(query) {
  const res = await client.query(
    `SELECT u.id, u.username, u.email, u.avatar_url, r.value as role
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.username ILIKE $1 OR u.email ILIKE $1`,
    [`%${query}%`]
  );
  return res.rows;
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
  searchUsers
};
