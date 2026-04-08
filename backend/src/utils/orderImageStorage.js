import fs from 'fs';
import path from 'path';

import { env } from '../config/env.js';

function ensureOrderImageUploadDir() {
  fs.mkdirSync(env.orderImagesDir, { recursive: true });
}

function resolveOrderImagePath(imageKey) {
  const safeKey = String(imageKey || '').trim();
  const baseDir = path.resolve(env.orderImagesDir);
  const resolvedPath = path.resolve(baseDir, safeKey);

  if (!safeKey || !resolvedPath.startsWith(`${baseDir}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

export { ensureOrderImageUploadDir, resolveOrderImagePath };
