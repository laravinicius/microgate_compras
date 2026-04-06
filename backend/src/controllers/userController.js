import {
  createUser,
  deleteUser,
  listUsers,
  updateUser
} from '../services/userService.js';

const allowedRoles = ['administrador', 'comprador', 'solicitante'];
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  if (!email) return ''; // Email é opcional
  return emailRegex.test(email) ? '' : 'Email invalido.';
}

function validateUserPayload({ name, username, password, role, email }, isEditing = false) {
  if (!String(name ?? '').trim()) {
    return 'Informe o nome do usuario.';
  }

  if (!String(username ?? '').trim()) {
    return 'Informe o nome de acesso do usuario.';
  }

  if (!isEditing && !String(password ?? '').trim()) {
    return 'Informe a senha do usuario.';
  }

  if (!allowedRoles.includes(role)) {
    return 'Perfil de usuario invalido.';
  }

  const emailError = validateEmail(email);
  if (emailError) {
    return emailError;
  }

  return '';
}

async function getUsers(_request, response, next) {
  try {
    const users = await listUsers();
    response.json({ users });
  } catch (error) {
    next(error);
  }
}

async function createUserHandler(request, response, next) {
  try {
    const payload = {
      name: String(request.body?.name ?? '').trim(),
      username: String(request.body?.username ?? '').trim().toLowerCase(),
      password: String(request.body?.password ?? ''),
      email: String(request.body?.email ?? '').trim().toLowerCase() || null,
      role: String(request.body?.role ?? 'solicitante').trim()
    };
    const validationError = validateUserPayload(payload);

    if (validationError) {
      response.status(400).json({ error: validationError });
      return;
    }

    const user = await createUser(payload);
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

async function updateUserHandler(request, response, next) {
  try {
    const payload = {
      name: String(request.body?.name ?? '').trim(),
      username: String(request.body?.username ?? '').trim().toLowerCase(),
      password: String(request.body?.password ?? ''),
      email: String(request.body?.email ?? '').trim().toLowerCase() || null,
      role: String(request.body?.role ?? 'solicitante').trim()
    };
    const validationError = validateUserPayload(payload, true);

    if (validationError) {
      response.status(400).json({ error: validationError });
      return;
    }

    const user = await updateUser(Number(request.params.id), payload);

    if (!user) {
      response.status(404).json({
        error: 'Usuario nao encontrado.'
      });
      return;
    }

    response.json({ user });
  } catch (error) {
    next(error);
  }
}

async function deleteUserHandler(request, response, next) {
  try {
    const userId = Number(request.params.id);

    if (request.user?.id === userId) {
      response.status(400).json({
        error: 'O administrador logado nao pode remover a propria conta.'
      });
      return;
    }

    const deleted = await deleteUser(userId);

    if (!deleted) {
      response.status(404).json({
        error: 'Usuario nao encontrado.'
      });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
}

export {
  createUserHandler,
  deleteUserHandler,
  getUsers,
  updateUserHandler
};
