import { findUserById, normalizeUser } from '../services/userService.js';
import { verifyToken } from '../utils/token.js';

async function requireAuth(request, response, next) {
  try {
    const authorizationHeader = request.headers.authorization ?? '';
    const token = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice(7)
      : '';

    const payload = verifyToken(token);

    if (!payload?.sub) {
      response.status(401).json({
        error: 'Autenticacao obrigatoria.'
      });
      return;
    }

    const user = await findUserById(payload.sub);

    if (!user) {
      response.status(401).json({
        error: 'Usuario autenticado nao encontrado.'
      });
      return;
    }

    request.user = normalizeUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') {
    response.status(403).json({
      error: 'Acesso permitido apenas para administradores.'
    });
    return;
  }

  next();
}

export { requireAdmin, requireAuth };
