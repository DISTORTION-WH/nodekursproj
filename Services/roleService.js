const client = require("../databasepg");

async function findRoleByValue(value) {
  try {
    const result = await client.query("SELECT * FROM roles WHERE value = $1", [
      value,
    ]);
    return result.rows[0];
  } catch (err) {
    console.error(
      `[RoleService] Ошибка findRoleByValue (${value}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function findRoleById(id) {
  try {
    const result = await client.query("SELECT * FROM roles WHERE id = $1", [
      id,
    ]);
    return result.rows[0];
  } catch (err) {
    console.error(
      `[RoleService] Ошибка findRoleById (${id}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

module.exports = { findRoleByValue, findRoleById };
