import { getHealthStatus } from '../services/healthService.js';

async function getHealth(_request, response, next) {
  try {
    const health = await getHealthStatus();
    response.json(health);
  } catch (error) {
    next(error);
  }
}

export { getHealth };

