const client = require("../databasepg");

async function findRoleByValue(value) {
  const result = await client.query(
    "SELECT * FROM roles WHERE value = $1",
    [value]
  );
  return result.rows[0];
}

async function findRoleById(id) {
  const result = await client.query(
    "SELECT * FROM roles WHERE id = $1",
    [id]
  );
  return result.rows[0];
}

module.exports = { findRoleByValue, findRoleById };
