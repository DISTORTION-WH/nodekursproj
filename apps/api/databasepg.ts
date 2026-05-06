import { Client, ClientConfig } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_DATABASE"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `FATAL: Не заданы обязательные переменные окружения БД: ${missing.join(", ")}`
    );
  }
}

const isProduction = !!connectionString && !connectionString.includes("localhost");

const clientConfig: ClientConfig = {
  connectionString: connectionString ?? undefined,

  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,

  // В продакшене SSL с проверкой сертификата.
  // Установите DB_SSL_NO_VERIFY=true только если хостинг использует self-signed cert.
  ssl: isProduction
    ? { rejectUnauthorized: process.env.DB_SSL_NO_VERIFY !== "true" }
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
  .catch((err: Error) => {
    console.error("❗️ КРИТИЧЕСКАЯ ОШИБКА подключения к PostgreSQL:", err.message);
    process.exit(1);
  });

export default client;