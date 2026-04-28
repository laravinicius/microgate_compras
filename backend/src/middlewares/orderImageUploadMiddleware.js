import crypto from 'crypto';

import multer from 'multer';

import { env } from '../config/env.js';
import { ensureOrderImageUploadDir } from '../utils/orderImageStorage.js';

const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedVideoMimeTypes = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);
const imageExtensionByMimeType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
const videoExtensionByMimeType = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov'
};

const uploadStorage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    ensureOrderImageUploadDir();
    callback(null, env.orderImagesDir);
  },
  filename: (_request, file, callback) => {
    const extension =
      imageExtensionByMimeType[file.mimetype] || videoExtensionByMimeType[file.mimetype] || 'bin';
    callback(null, `${crypto.randomUUID()}.${extension}`);
  }
});

const createOrderUpload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: env.maxOrderVideoFileSizeBytes,
    files: env.maxOrderMediaFilesPerRequest
  },
  fileFilter: (_request, file, callback) => {
    const isImageField = file.fieldname.startsWith('itemImage_');
    const isVideoField = file.fieldname.startsWith('itemVideo_');

    if (!isImageField && !isVideoField) {
      const fieldError = new Error('Campo de upload invalido.');
      fieldError.code = 'UPLOAD_INVALID_FIELD';
      callback(fieldError);
      return;
    }

    if (isImageField && !allowedImageMimeTypes.has(file.mimetype)) {
      const mimeError = new Error('Tipo de arquivo nao permitido. Use JPG, PNG ou WEBP.');
      mimeError.code = 'UPLOAD_INVALID_FILE_TYPE';
      callback(mimeError);
      return;
    }

    if (isVideoField && !allowedVideoMimeTypes.has(file.mimetype)) {
      const mimeError = new Error('Tipo de arquivo nao permitido. Use MP4, WEBM, OGG ou MOV.');
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
  allowedVideoMimeTypes,
  createOrderUploadMiddleware
};
