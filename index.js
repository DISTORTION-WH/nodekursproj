// --- ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК ---
process.on('uncaughtException', (err, origin) => {
  console.error('❗️ НЕПЕРЕХВАЧЕННАЯ ОШИБКА (UNCAUGHT EXCEPTION):');
  console.error('❗️ Ошибка:', err.message);
  console.error('❗️ Источник:', origin);
  console.error(err.stack);
  process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❗️ НЕОБРАБОТАННЫЙ REJECT PROMISE-A (UNHANDLED REJECTION):');
  console.error('❗️ Причина:', reason);
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
const usersRouter = require("./Routes/usersRouter");
const friendsRouter = require("./Routes/friendsRouter"); 
const chatDeleteRouter = require("./Routes/chatDeleteRouter");
const adminRouter = require("./Routes/adminRouter");

const PORT = process.env.PORT || 5000;

const app = express();

// --- НАСТРОЙКА CORS ДЛЯ ДЕПЛОЯ ---
const allowedOrigins = [
  'http://localhost:3000', // Для локальной разработки
  process.env.FRONTEND_URL,  // Это ваш 'https://nodekursproj-front.vercel.app'
  'https://nodekursproj.vercel.app' 
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

// --- ❗️ ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК EXPRESS ---
// Он должен быть *после* всех роутеров
app.use((err, req, res, next) => {
  console.error("❗️ ОБНАРУЖЕНА ОШИБКА EXPRESS:");
  console.error('❗️ Путь:', req.path);
  console.error('❗️ Ошибка:', err.message);
  console.error(err.stack); // Полный стек для дебага

  const statusCode = err.status || 500; 
  
  // Отправляем на фронтенд КОНКРЕТНУЮ ошибку
  const clientMessage = err.message || "Внутренняя ошибка сервера";

  res.status(statusCode).json({ 
    message: clientMessage 
  });
});
// --- КОНЕЦ ОБРАБОТЧИКА ОШИБОК EXPRESS ---


/**
 * Эта функция создаст ВСЕ таблицы, если их нет.
 * А также ИСПРАВИТ таблицу users, если в ней нет колонки 'email'.
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
    
     await client.query(`
      INSERT INTO roles (value) 
      VALUES ('USER'), ('ADMIN') 
      ON CONFLICT (value) DO NOTHING;
    `);
    console.log("✅ Роли 'USER' и 'ADMIN' проверены.");


    // 2. Таблица Users (БЕЗ 'email' для обратной совместимости)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("✅ Таблица 'users' готова.");

    // ❗️❗️❗️ ВОТ ИСПРАВЛЕНИЕ ❗️❗️❗️
    // Пытаемся "вылечить" старую таблицу 'users', добавив колонку 'email'.
    try {
      await client.query(`
        ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;
      `);
      // Эта строка появится в логах Render ОДИН РАЗ
      console.log("✅ (ИСПРАВЛЕНИЕ) Колонка 'email' успешно ДОБАВЛЕНА в таблицу 'users'.");
    } catch (e) {
      if (e.code === '42701') { // 42701 = duplicate_column
        // Эта строка будет появляться в логах при каждом запуске, ЭТО НОРМАЛЬНО
        console.log("ℹ️ Колонка 'email' в 'users' уже существует.");
      } else {
        throw e; // Пробрасываем другие ошибки (если они есть)
      }
    }
    // ❗️❗️❗️ КОНЕЦ ИСПРАВЛЕНИЯ ❗️❗️❗️


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

    console.log("--- Инициализация базы данных завершена ---");

  } catch (e) {
    console.error("❗️ Ошибка при инициализации базы данных:", e);
    process.exit(1); // Выходим, если не удалось создать таблицы
  }
}

async function start() {
  try {
    // СНАЧАЛА создаём/исправляем таблицы
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log("🚀 Server started on port " + PORT);
    });
  } catch (e) {
    console.error("Ошибка при запуске:", e);
  }
}

start();