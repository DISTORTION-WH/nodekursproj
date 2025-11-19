import * as Minio from "minio";

const BUCKET_NAME = "node-kurs";
const PUBLIC_URL_PREFIX = "https://pub-41f206f40fda4a2da449b717be51aa11.r2.dev";

const minioClient = new Minio.Client({
  endPoint: "a4b99c3eee7f6f5160d4572abc213e2d.r2.cloudflarestorage.com",
  accessKey: "fdd0c5be5b0e48fcb4b78cf2932a34c6",
  secretKey: "c8e5c47329aa89dffb735d259216f62a9babf537d35cd295b87c7eb106b36dc9",
  useSSL: true,
});

class MinioService {
  constructor() {
    this.init();
  }

  private async init() {
    try {
      const exists = await minioClient.bucketExists(BUCKET_NAME);
      if (!exists) {
        await minioClient.makeBucket(BUCKET_NAME, "us-east-1");
        console.log(`Bucket ${BUCKET_NAME} created.`);
      }
    } catch (err) {
      console.error("MinIO connection error:", err);
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