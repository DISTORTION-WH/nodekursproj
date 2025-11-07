const client = require("../databasepg");

class LogService {
  async error(message, meta = {}) {
    await this._saveLog("ERROR", message, meta);
    console.error(" [LOG-ERROR]", message, meta);
  }

  async info(message, meta = {}) {
    console.log(" [LOG-INFO]", message);
  }

  async warn(message, meta = {}) {
    await this._saveLog("WARN", message, meta);
    console.warn(" [LOG-WARN]", message, meta);
  }

  async _saveLog(level, message, meta) {
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

  async getRecentLogs(limit = 100) {
    const res = await client.query(
      "SELECT * FROM app_logs ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return res.rows;
  }
}

module.exports = new LogService();
