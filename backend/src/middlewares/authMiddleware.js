import { findUserById, normalizeUser } from '../services/userService.js';
import { verifyToken } from '../utils/token.js';

function normalizeRole(role) {
  if (role === 'admin') {
    return 'administrador';
  }

  if (role === 'user') {
    return 'solicitante';
  }

  return role;
}

function isAdministrator(user) {
  return normalizeRole(user?.role) === 'administrador';
}

function isBuyer(user) {
  return normalizeRole(user?.role) === 'comprador';
}

function isRequester(user) {
  return normalizeRole(user?.role) === 'solicitante';
}

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

function requirePasswordChangeComplete(request, response, next) {
  if (request.user?.passwordChangeRequired) {
    response.status(403).json({
      error: 'Voce precisa alterar a senha inicial antes de continuar.'
    });
    return;
  }

  next();
}

function requireAdmin(request, response, next) {
  if (!isAdministrator(request.user)) {
    response.status(403).json({
      error: 'Acesso permitido apenas para administradores.'
    });
    return;
  }

  next();
}

export {
  isAdministrator,
  isBuyer,
  isRequester,
  normalizeRole,
  requireAdmin,
  requireAuth,
  requirePasswordChangeComplete
};
