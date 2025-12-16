import { Client, ClientConfig } from "pg";
import dotenv from "dotenv";

// Загружаем переменные из .env файла (если мы локально)
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const clientConfig: ClientConfig = {
  // Если есть строка подключения (деплой) - используем её
  // Если нет - берем параметры из .env (локально)
  connectionString: connectionString ? connectionString : undefined,
  
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "1234",
  database: process.env.DB_DATABASE || "postgres",

  // SSL включаем только если мы не на localhost и есть connectionString (обычно это прод)
  ssl: connectionString && !connectionString.includes("localhost") 
    ? { rejectUnauthorized: false } 
    : false,
};

const client = new Client(clientConfig);

client.on("error", (err: Error) => {
  console.error("❗️ НЕОЖИДАННАЯ ОШИБКА КЛИЕНТА POSTGRESQL:", err.message);
});

client.on("end", () => {
  console.log("ℹ️ Клиент PostgreSQL отключился.");
});

client
  .connect()
  .then(() => console.log("✅ Успешно подключено к PostgreSQL"))
  .catch((err) => {
    console.error("❗️ КРИТИЧЕСКАЯ ОШИБКА подключения к PostgreSQL:", err.message);
    // Не убиваем процесс сразу, чтобы локально видеть ошибку, если БД еще поднимается
    // process.exit(1); 
  });

export default client;