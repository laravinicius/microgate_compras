import crypto from 'crypto';

import { env } from '../config/env.js';

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signToken(payload) {
  const serializedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', env.authSecret)
    .update(serializedPayload)
    .digest('base64url');

  return `${serializedPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [serializedPayload, signature] = token.split('.');
  const expectedSignature = crypto
    .createHmac('sha256', env.authSecret)
    .update(serializedPayload)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null;
  }

  const payload = JSON.parse(decodeBase64Url(serializedPayload));

  if (payload.exp && Date.now() > payload.exp) {
    return null;
  }

  return payload;
}

export { signToken, verifyToken };
