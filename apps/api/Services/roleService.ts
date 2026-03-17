import client from "../databasepg";
import { QueryResult } from "pg";

export interface Role {
  id: number;
  value: string;
}

async function findRoleByValue(value: string): Promise<Role | undefined> {
  try {
    const result: QueryResult<Role> = await client.query(
      "SELECT * FROM roles WHERE value = $1",
      [value]
    );
    return result.rows[0];
  } catch (err: any) {
    console.error(
      `[RoleService] Ошибка findRoleByValue (${value}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

async function findRoleById(id: number | string): Promise<Role | undefined> {
  try {
    const result: QueryResult<Role> = await client.query(
      "SELECT * FROM roles WHERE id = $1",
      [id]
    );
    return result.rows[0];
  } catch (err: any) {
    console.error(
      `[RoleService] Ошибка findRoleById (${id}):`,
      err.message,
      err.stack
    );
    throw err;
  }
}

export default {
  findRoleByValue,
  findRoleById,
};