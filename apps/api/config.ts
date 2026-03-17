import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET не задан в .env — используется небезопасный ключ по умолчанию. Установите JWT_SECRET перед деплоем!");
}

export const secret: string = process.env.JWT_SECRET || "SECRET_KEY_RANDOM";