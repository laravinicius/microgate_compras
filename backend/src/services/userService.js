import { query } from '../config/db.js';
import { hashPassword } from '../utils/password.js';

function normalizeUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    createdAt: row.created_at
  };
}

async function findUserByUsername(username) {
  const result = await query(
    `
      SELECT id, name, username, role, password_hash, created_at
      FROM users
      WHERE username = $1
    `,
    [username]
  );

  return result.rows[0] ?? null;
}

async function findUserById(id) {
  const result = await query(
    `
      SELECT id, name, username, role, password_hash, created_at
      FROM users
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

async function listUsers() {
  const result = await query(
    `
      SELECT id, name, username, role, created_at
      FROM users
      ORDER BY created_at DESC, id DESC
    `
  );

  return result.rows.map(normalizeUser);
}

async function createUser({ name, username, password, role }) {
  const result = await query(
    `
      INSERT INTO users (name, username, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, username, role, created_at
    `,
    [name, username, hashPassword(password), role]
  );

  return normalizeUser(result.rows[0]);
}

async function updateUser(id, { name, username, password, role }) {
  const values = [id, name, username, role];
  let passwordFragment = '';

  if (password) {
    values.push(hashPassword(password));
    passwordFragment = ', password_hash = $5';
  }

  const result = await query(
    `
      UPDATE users
      SET
        name = $2,
        username = $3,
        role = $4
        ${passwordFragment}
      WHERE id = $1
      RETURNING id, name, username, role, created_at
    `,
    values
  );

  return result.rows[0] ? normalizeUser(result.rows[0]) : null;
}

async function deleteUser(id) {
  const result = await query(
    `
      DELETE FROM users
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return Boolean(result.rowCount);
}

export {
  createUser,
  deleteUser,
  findUserByUsername,
  findUserById,
  listUsers,
  normalizeUser,
  updateUser
};
