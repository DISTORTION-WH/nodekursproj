const client = require("../databasepg");

class LogService {
  async error(message, meta = {}) {
    await this._saveLog("ERROR", message, meta);
    console.error(" [LOG-ERROR]", message, meta);
  }

  async info(message, meta = {}) {
    // Можно раскомментировать запись INFO в БД, если нужно,
    // но чтобы не засорять БД, часто пишут только важные info или ошибки.
    // await this._saveLog("INFO", message, meta);
    console.log(" [LOG-INFO]", message);
  }

  async warn(message, meta = {}) {
    await this._saveLog("WARN", message, meta);
    console.warn(" [LOG-WARN]", message, meta);
  }

  async _saveLog(level, message, meta) {
    try {
      // Преобразуем Error объект в обычный объект для сохранения в JSONB
      let metaToSave = meta;
      if (meta instanceof Error) {
        metaToSave = { stack: meta.stack, message: meta.message };
      }

      await client.query(
        "INSERT INTO app_logs (level, message, meta) VALUES ($1, $2, $3)",
        [level, message, JSON.stringify(metaToSave)]
      );
    } catch (err) {
      // Если не удалось записать лог в БД, пишем в консоль, чтобы не зациклить ошибку
      console.error("FAILED TO SAVE LOG TO DB:", err);
    }
  }

  // Метод для получения логов (используется в контроллере)
  async getRecentLogs(limit = 100) {
    const res = await client.query(
      "SELECT * FROM app_logs ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return res.rows;
  }
}

module.exports = new LogService();