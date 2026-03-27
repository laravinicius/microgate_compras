import { verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { findUserByUsername, normalizeUser } from './userService.js';

const TOKEN_TTL_IN_MS = 1000 * 60 * 60 * 12;

async function authenticateUser(username, password) {
  const user = await findUserByUsername(username);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  const sanitizedUser = normalizeUser(user);
  const token = signToken({
    sub: sanitizedUser.id,
    name: sanitizedUser.name,
    username: sanitizedUser.username,
    role: sanitizedUser.role,
    exp: Date.now() + TOKEN_TTL_IN_MS
  });

  return {
    token,
    user: sanitizedUser
  };
}

export { authenticateUser };
