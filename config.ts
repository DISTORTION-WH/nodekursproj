import dotenv from "dotenv";
dotenv.config();

export const secret: string = process.env.JWT_SECRET || "SECRET_KEY_RANDOM";