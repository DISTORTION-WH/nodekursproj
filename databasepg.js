const { Client } = require("pg");

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString: connectionString,

  ssl: connectionString ? { rejectUnauthorized: false } : false,

  ...(!connectionString && {
    host: "localhost",
    user: "postgres",
    port: 5432,
    password: "1234",
    database: "postgres",
  }),
});

client.on("error", (err) => {
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

module.exports = client;
