import crypto from 'crypto';

function derivePasswordHash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = derivePasswordHash(password, salt);

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  const [salt, hash] = storedHash.split(':');

  if (!salt || !hash) {
    return false;
  }

  const candidateHash = derivePasswordHash(password, salt);

  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(candidateHash, 'hex')
  );
}

export { hashPassword, verifyPassword };
