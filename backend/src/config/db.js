import pg from 'pg';

import { env } from './env.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.databaseUrl
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function checkDatabaseConnection() {
  const result = await query('SELECT NOW() AS current_time');
  return result.rows[0];
}

export { checkDatabaseConnection, pool, query };
