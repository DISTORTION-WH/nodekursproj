import * as Minio from "minio";
import dotenv from "dotenv";

dotenv.config();

// Берем настройки из .env
const ENDPOINT = process.env.MINIO_ENDPOINT || "";
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "";
const SECRET_KEY = process.env.MINIO_SECRET_KEY || "";
const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || "node-kurs";
const PUBLIC_URL_PREFIX = process.env.MINIO_PUBLIC_URL || "";

// Проверка на наличие ключей, чтобы не падать с ошибкой "пустой host"
if (!ENDPOINT || !ACCESS_KEY || !SECRET_KEY) {
  console.warn("⚠️ Внимание: Не заданы настройки MINIO (R2) в .env. Загрузка файлов не будет работать.");
}

const minioClient = new Minio.Client({
  endPoint: ENDPOINT,
  accessKey: ACCESS_KEY,
  secretKey: SECRET_KEY,
  useSSL: true, // Для R2 всегда true
});

class MinioService {
  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Для R2 bucketExists может требовать специфических прав,
      // поэтому иногда этот блок лучше обернуть в try/catch или пропустить,
      // если вы уверены, что бакет существует.
      /*
      const exists = await minioClient.bucketExists(BUCKET_NAME);
      if (!exists) {
        console.log(`Bucket ${BUCKET_NAME} not found (or access denied). Assuming it exists.`);
      }
      */
    } catch (err) {
      console.error("MinIO init warning:", err);
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const timestamp = Date.now();
    const uniqueName = `${timestamp}-${Math.round(Math.random() * 1e9)}-${file.originalname.replace(/\s+/g, "-")}`;

    await minioClient.putObject(
      BUCKET_NAME,
      uniqueName,
      file.buffer,
      file.size,
      { "Content-Type": file.mimetype }
    );

    return `${PUBLIC_URL_PREFIX}/${uniqueName}`;
  }
}

export default new MinioService();