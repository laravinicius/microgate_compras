import { authenticateUser } from '../services/authService.js';

async function login(request, response, next) {
  try {
    const username = String(request.body?.username ?? '').trim().toLowerCase();
    const password = String(request.body?.password ?? '');

    if (!username || !password) {
      response.status(400).json({
        error: 'Informe usuario e senha.'
      });
      return;
    }

    const session = await authenticateUser(username, password);

    if (!session) {
      response.status(401).json({
        error: 'Credenciais invalidas.'
      });
      return;
    }

    response.json(session);
  } catch (error) {
    next(error);
  }
}

function getCurrentUser(request, response) {
  response.json({
    user: request.user
  });
}

export { getCurrentUser, login };
