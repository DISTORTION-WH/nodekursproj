const { Client } = require("pg");

// Используем DATABASE_URL из переменных окружения, если она есть
// А если ее нет (локальный запуск), используем старые данные
const connectionString = process.env.DATABASE_URL;

const client = new Client({
  // ❗️ Render/Heroku предоставляют URL в process.env.DATABASE_URL
  connectionString: connectionString, 
  
  // ❗️ SSL обязателен для подключения к Render
  ssl: connectionString ? { rejectUnauthorized: false } : false, 

  // 👇 Этот блок будет использоваться, только если process.env.DATABASE_URL не найден
  ...(!connectionString && {
    host: "localhost",
    user: "postgres",
    port: 5432,
    password: "1234",
    database: "postgres",
  })
});

client.connect()
  .then(() => console.log("✅ Успешно подключено к PostgreSQL"))
  .catch(err => console.error("❗️ Ошибка подключения к PostgreSQL:", err.stack));

module.exports = client;