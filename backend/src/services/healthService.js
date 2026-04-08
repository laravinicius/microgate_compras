import { checkDatabaseConnection } from '../config/db.js';

async function getHealthStatus() {
  const database = await checkDatabaseConnection();

  return {
    status: 'ok',
    database: 'connected',
    databaseTime: database.current_time
  };
}

export { getHealthStatus };

