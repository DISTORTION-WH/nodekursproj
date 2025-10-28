const client = require("../databasepg");

async function createRolesTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      value VARCHAR(50) UNIQUE NOT NULL DEFAULT 'USER'
    );
  `;
  await client.query(query);
  console.log("✅ Таблица roles создана");
}

module.exports = { createRolesTable };
