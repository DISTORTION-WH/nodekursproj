// --- ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК ---
// (Ловят ошибки, не связанные с Express)
process.on('uncaughtException', (err, origin) => {
  console.error('❗️ НЕПЕРЕХВАЧЕННАЯ ОШИБКА (UNCAUGHT EXCEPTION):');
  console.error('❗️ Ошибка:', err.message);
  console.error('❗️ Источник:', origin);
  console.error(err.stack);
  // Приложение в нестабильном состоянии. Лучше завершить.
  process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❗️ НЕОБРАБОТАННЫЙ REJECT PROMISE-A (UNHANDLED REJECTION):');
  console.error('❗️ Причина:', reason);
  // В 'reason' может быть сам объект ошибки
  if (reason instanceof Error) {
    console.error(reason.stack);
  }
});
// --- КОНЕЦ ГЛОБАЛЬНЫХ ОБРАБОТЧИКОВ ---

const express = require("express");
const cors = require("cors");
const client = require("./databasepg"); // 👈 Убедитесь, что client импортирован
const authRouter = require("./Routes/authRouter");
const chatRouter = require("./Routes/chatRouter");
// const { createRolesTable } = require("./models/Role"); // 👈 Больше не нужно
// const { createUsersTable } = require("./models/User"); // 👈 Больше не нужно
const usersRouter = require("./Routes/usersRouter");
const friendsRouter = require("./Routes/friendsRouter"); 
const chatDeleteRouter = require("./Routes/chatDeleteRouter");
const adminRouter = require("./Routes/adminRouter");

const PORT = process.env.PORT || 5000;

const app = express();

// --- НАСТРОЙКА CORS ДЛЯ ДЕПЛОЯ ---
// URL вашего будущего фронтенда на Vercel
const allowedOrigins = [
  'http://localhost:3000', // Для локальной разработки
  process.env.FRONTEND_URL,  // Это ваш 'https://nodekursproj-front.vercel.app'
  'https://nodekursproj.vercel.app' // 👈 ДОБАВЬТЕ ЭТУ СТРОКУ
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`CORS ERROR: Origin '${origin}' NOT ALLOWED.`);
      console.log('Allowed origins are:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
// --- КОНЕЦ НАСТРОЙКИ CORS ---

app.use(express.json());
app.use("/auth", authRouter);
app.use("/chats", chatRouter);
app.use("/friends", friendsRouter);
app.use("/users", usersRouter);
app.use("/uploads/avatars", express.static("uploads/avatars"));
app.use("/chats", chatDeleteRouter);     
app.use("/admin", adminRouter);

// --- ❗️ НОВЫЙ ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК EXPRESS ---
// Этот middleware должен быть *последним* в цепочке app.use(),
// после всех роутеров. Express 5 автоматически перехватывает
// ошибки в async-функциях и передает их сюда.
app.use((err, req, res, next) => {
  // Логируем ошибку на сервере (в Render)
  console.error("❗️ ОБНАРУЖЕНА ОШИБКА EXPRESS:");
  console.error('❗️ Путь:', req.path);
  console.error('❗️ Ошибка:', err.message);
  console.error(err.stack); // Полный стек для дебага

  // Отправляем безопасный ответ клиенту
  // Если у ошибки есть статус (например, 404, 403), используем его
  const statusCode = err.status || 500; 
  
  // Не отправляем 'err.message' клиенту, если это 500, 
  // чтобы случайно не раскрыть детали реализации.
  const clientMessage = statusCode === 500 ? "Внутренняя ошибка сервера" : err.message;

  res.status(statusCode).json({ 
    message: clientMessage 
  });
});
// --- КОНЕЦ ОБРАБОТЧИКА ОШИБОК EXPRESS ---


/**
 * Эта функция создаст ВСЕ таблицы из вашего deploy1.sql, если их нет.
 * Она гарантирует, что ваша пустая база на Render будет готова к работе.
 */
async function initializeDatabase() {
  try {
    console.log("Инициализация базы данных...");

    // 1. Таблица Roles
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        value VARCHAR(50) UNIQUE NOT NULL DEFAULT 'USER'
      );
    `);
    console.log("✅ Таблица 'roles' готова.");
    
    // Добавляем роли, если их нет
     await client.query(`
      INSERT INTO roles (value) 
      VALUES ('USER'), ('ADMIN') 
      ON CONFLICT (value) DO NOTHING;
    `);
    console.log("✅ Роли 'USER' и 'ADMIN' проверены.");


    // 2. Таблица Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        email VARCHAR(255) UNIQUE
      );
    `);
    console.log("✅ Таблица 'users' готова.");

    // 3. Таблица Chats
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50),
        is_group BOOLEAN DEFAULT false,
        creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        invite_code VARCHAR(16) UNIQUE
      );
      CREATE INDEX IF NOT EXISTS idx_chats_invite_code ON chats(invite_code);
    `);
    console.log("✅ Таблица 'chats' готова.");

    // 4. Таблица Chat_Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_users (
        id SERIAL PRIMARY KEY,
        chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log("✅ Таблица 'chat_users' готова.");

    // 5. Таблица Messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_for INTEGER[] DEFAULT '{}'::integer[]
      );
    `);
    console.log("✅ Таблица 'messages' готова.");

    // 6. Таблица Friends
    await client.query(`
      CREATE TABLE IF NOT EXISTS friends (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, friend_id)
      );
    `);
    console.log("✅ Таблица 'friends' готова.");
    
    // 7. Таблица Registration_Codes
    await client.query(`
      CREATE TABLE IF NOT EXISTS registration_codes (
          email VARCHAR(255) PRIMARY KEY NOT NULL,
          username VARCHAR(50) NOT NULL,
          password TEXT NOT NULL,
          avatar_url TEXT,
          code VARCHAR(6) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("✅ Таблица 'registration_codes' готова.");

    // (Таблица pending_users из deploy1.sql не включена, 
    // так как вы используете 'registration_codes' в authController.js)

    console.log("--- Инициализация базы данных завершена ---");

  } catch (e) {
    console.error("❗️ Ошибка при инициализации базы данных:", e);
    process.exit(1); // Выходим, если не удалось создать таблицы
  }
}

async function start() {
  try {
    // СНАЧАЛА создаём таблицы
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log("🚀 Server started on port " + PORT);
    });
  } catch (e) {
    console.error("Ошибка при запуске:", e);
  }
}

start();