import dotenv from "dotenv";
dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error(
    "FATAL: JWT_SECRET не задан в переменных окружения. Приложение не может быть запущено без явного секрета."
  );
}

export const secret: string = jwtSecret;
