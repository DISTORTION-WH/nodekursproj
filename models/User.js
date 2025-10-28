// models/User.js
const client = require("../databasepg");

async function createUsersTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      avatar_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

module.exports = { createUsersTable };
