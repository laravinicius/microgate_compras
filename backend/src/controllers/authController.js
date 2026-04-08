import { verifyPassword } from '../utils/password.js';
import { authenticateUser } from '../services/authService.js';
import { findUserById, updateUserPassword } from '../services/userService.js';

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

async function changePassword(request, response, next) {
  try {
    const currentPassword = String(request.body?.currentPassword ?? '').trim();
    const newPassword = String(request.body?.newPassword ?? '').trim();

    if (!currentPassword || !newPassword) {
      response.status(400).json({
        error: 'Informe a senha atual e a nova senha.'
      });
      return;
    }

    const storedUser = await findUserById(request.user.id);

    if (!storedUser || !verifyPassword(currentPassword, storedUser.password_hash)) {
      response.status(400).json({
        error: 'Senha atual invalida.'
      });
      return;
    }

    if (currentPassword === newPassword) {
      response.status(400).json({
        error: 'A nova senha deve ser diferente da atual.'
      });
      return;
    }

    const user = await updateUserPassword(request.user.id, newPassword);

    response.json({ user });
  } catch (error) {
    next(error);
  }
}

export { changePassword, getCurrentUser, login };
