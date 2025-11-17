import { Client, ClientConfig } from "pg";

const connectionString: string | undefined = process.env.DATABASE_URL;
const clientConfig: ClientConfig = {
  connectionString: connectionString,

  ssl: connectionString ? { rejectUnauthorized: false } : false,

  ...(!connectionString 
    ? {
    host: "localhost",
    user: "postgres",
    port: 5432,
    password: "1234",
    database: "postgres",
  } : {}),
};

const client = new Client(clientConfig);

client.on("error", (err: Error) => {
  console.error("❗️ НЕОЖИДАННАЯ ОШИБКА КЛИЕНТА POSTGRESQL (во время работы):");
  console.error(err.message, err.stack);
});

client.on("end", () => {
  console.log("ℹ️ Клиент PostgreSQL штатно отключился.");
});

client
  .connect()
  .then(() => console.log("✅ Успешно подключено к PostgreSQL"))
  .catch((err) => {
    console.error(
      "❗️ КРИТИЧЕСКАЯ ОШИБКА подключения к PostgreSQL:",
      err.stack
    );
    process.exit(1);
  });

export default client;