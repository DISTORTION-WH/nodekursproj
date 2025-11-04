const { Client } = require("pg");

// Используем DATABASE_URL из переменных окружения, если она есть
// А если ее нет (локальный запуск), используем старые данные
const connectionString = process.env.DATABASE_URL || {
  host: "localhost",
  user: "postgres",
  port: 5432,
  password: "1234",
  database: "postgres",
};

const client = new Client({
  connectionString: process.env.DATABASE_URL, // 👈 Это для хостинга
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false, // 👈 Обязательно для Render/Heroku

  // 👇 Это для локального запуска, если DATABASE_URL нет
  ...(!process.env.DATABASE_URL && {
    host: "localhost",
    user: "postgres",
    port: 5432,
    password: "1234",
    database: "postgres",
  })
});

client.connect();

module.exports = client;