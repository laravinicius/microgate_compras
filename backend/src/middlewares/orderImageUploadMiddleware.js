import crypto from 'crypto';

import multer from 'multer';

import { env } from '../config/env.js';
import { ensureOrderImageUploadDir } from '../utils/orderImageStorage.js';

const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const imageExtensionByMimeType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const uploadStorage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    ensureOrderImageUploadDir();
    callback(null, env.orderImagesDir);
  },
  filename: (_request, file, callback) => {
    const extension = imageExtensionByMimeType[file.mimetype] || 'bin';
    callback(null, `${crypto.randomUUID()}.${extension}`);
  }
});

const createOrderUpload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: env.maxOrderImageFileSizeBytes,
    files: env.maxOrderImagesPerRequest
  },
  fileFilter: (_request, file, callback) => {
    if (!file.fieldname.startsWith('itemImage_')) {
      const fieldError = new Error('Campo de upload invalido.');
      fieldError.code = 'UPLOAD_INVALID_FIELD';
      callback(fieldError);
      return;
    }

    if (!allowedImageMimeTypes.has(file.mimetype)) {
      const mimeError = new Error('Tipo de arquivo nao permitido. Use JPG, PNG ou WEBP.');
      mimeError.code = 'UPLOAD_INVALID_FILE_TYPE';
      callback(mimeError);
      return;
    }

    callback(null, true);
  }
});

const createOrderUploadMiddleware = createOrderUpload.any();

export {
  allowedImageMimeTypes,
  createOrderUploadMiddleware
};
