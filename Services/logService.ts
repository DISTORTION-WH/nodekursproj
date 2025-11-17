import client from "../databasepg";
import { QueryResult } from "pg";

export interface AppLog {
  id: number;
  level: string;
  message: string;
  meta: any;
  created_at: Date;
}

class LogService {
  async error(message: string, meta: any = {}): Promise<void> {
    await this._saveLog("ERROR", message, meta);
    console.error(" [LOG-ERROR]", message, meta);
  }

  async info(message: string, meta: any = {}): Promise<void> {
    console.log(" [LOG-INFO]", message);
  }

  async warn(message: string, meta: any = {}): Promise<void> {
    await this._saveLog("WARN", message, meta);
    console.warn(" [LOG-WARN]", message, meta);
  }

  private async _saveLog(level: string, message: string, meta: any): Promise<void> {
    try {
      let metaToSave = meta;
      if (meta instanceof Error) {
        metaToSave = { stack: meta.stack, message: meta.message };
      }

      await client.query(
        "INSERT INTO app_logs (level, message, meta) VALUES ($1, $2, $3)",
        [level, message, JSON.stringify(metaToSave)]
      );
    } catch (err) {
      console.error("FAILED TO SAVE LOG TO DB:", err);
    }
  }

  async getRecentLogs(limit: number = 100): Promise<AppLog[]> {
    const res: QueryResult<AppLog> = await client.query(
      "SELECT * FROM app_logs ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return res.rows;
  }
}

export default new LogService();