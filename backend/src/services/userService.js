import { query } from '../config/db.js';
import { hashPassword } from '../utils/password.js';

function normalizeUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email || null,
    role: row.role,
    passwordChangeRequired: Boolean(row.password_change_required),
    createdAt: row.created_at
  };
}

async function findUserByUsername(username) {
  const result = await query(
    `
      SELECT id, name, username, email, role, password_change_required, password_hash, created_at
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
      SELECT id, name, username, email, role, password_change_required, password_hash, created_at
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
      SELECT id, name, username, email, role, password_change_required, created_at
      FROM users
      ORDER BY created_at DESC, id DESC
    `
  );

  return result.rows.map(normalizeUser);
}

async function createUser({ name, username, password, email, role }) {
  const result = await query(
    `
      INSERT INTO users (name, username, password_hash, password_change_required, email, role)
      VALUES ($1, $2, $3, TRUE, $4, $5)
      RETURNING id, name, username, email, role, password_change_required, created_at
    `,
    [name, username, hashPassword(password), email, role]
  );

  return normalizeUser(result.rows[0]);
}

async function updateUser(id, { name, username, password, email, role, passwordChangeRequired }) {
  const values = [id, name, username, email, role];
  let passwordFragment = '';
  let passwordChangeRequiredFragment = '';

  if (password) {
    values.push(hashPassword(password));
    values.push(typeof passwordChangeRequired === 'boolean' ? passwordChangeRequired : true);
    passwordFragment = ', password_hash = $6';
    passwordChangeRequiredFragment = ', password_change_required = $7';
  }

  const result = await query(
    `
      UPDATE users
      SET
        name = $2,
        username = $3,
        email = $4,
        role = $5
        ${passwordChangeRequiredFragment}
        ${passwordFragment}
      WHERE id = $1
      RETURNING id, name, username, email, role, password_change_required, created_at
    `,
    values
  );

  return result.rows[0] ? normalizeUser(result.rows[0]) : null;
}

async function updatePasswordChangeRequirement(id, passwordChangeRequired) {
  const result = await query(
    `
      UPDATE users
      SET password_change_required = $2
      WHERE id = $1
      RETURNING id, name, username, email, role, password_change_required, created_at
    `,
    [id, Boolean(passwordChangeRequired)]
  );

  return result.rows[0] ? normalizeUser(result.rows[0]) : null;
}

async function updateUserPassword(id, password) {
  const result = await query(
    `
      UPDATE users
      SET
        password_hash = $2,
        password_change_required = FALSE
      WHERE id = $1
      RETURNING id, name, username, email, role, password_change_required, created_at
    `,
    [id, hashPassword(password)]
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
  updatePasswordChangeRequirement,
  updateUser,
  updateUserPassword
};
