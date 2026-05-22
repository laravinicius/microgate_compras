import {
  createOrder,
  deleteOrder,
  getOrderItemMedia,
  getOrderById,
  listOrders,
  reopenOrder,
  updateOrder
} from '../services/orderService.js';
import { env } from '../config/env.js';
import { resolveOrderImagePath } from '../utils/orderImageStorage.js';
import fs from 'fs/promises';

const allowedStatuses = [
  'pendente',
  'em_orcamento',
  'aguardando_aprovacao_do_cliente',
  'comprado/aguardando entrega',
  'comprado',
  'aguardando entrega',
  'finalizado',
  'cancelado'
];

function normalizeStatus(status) {
  if (status === 'em_orcamento' || status === 'em orcamento' || status === 'em orçamento' || status === 'em-orcamento') {
    return 'em_orcamento';
  }

  if (status === 'aguardando aprovacao do cliente' || status === 'aguardando aprovação do cliente' || status === 'aguardando_aprovacao_do_cliente' || status === 'aguardando_aprovacao') {
    return 'aguardando_aprovacao_do_cliente';
  }
  if (status === 'comprado' || status === 'aguardando entrega') {
    return 'comprado/aguardando entrega';
  }

  if (status === 'entregue' || status === 'delivered') {
    return 'finalizado';
  }

  return status;
}

function toCurrencyNumber(value) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return NaN;
  }

  return Number(normalizedValue.toFixed(2));
}

function getBaseSaleMultiplier(productValue) {
  return Number(productValue) < 1000 ? 1.7 : 1.6;
}

function calculateSaleValue(productValue, compraParaguai = false) {
  const baseMultiplier = getBaseSaleMultiplier(productValue);
  const finalMultiplier = compraParaguai ? baseMultiplier * 1.25 : baseMultiplier;

  return toCurrencyNumber(Number(productValue) * finalMultiplier);
}

function parseRelatedOsInput(relatedOsRaw) {
  const trimmedRelatedOs = String(relatedOsRaw ?? '').trim();

  if (!trimmedRelatedOs) {
    return { relatedOs: null };
  }

  const numericRelatedOs = Number(trimmedRelatedOs);

  if (!Number.isFinite(numericRelatedOs)) {
    return { relatedOs: null };
  }

  return { relatedOs: numericRelatedOs };
}

function parseBooleanInput(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return defaultValue;
}

function validateItems(items, allowPartial = false) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Adicione ao menos um item na Solicitação.';
  }

  for (const item of items) {
    if (!String(item.productName ?? '').trim() && !allowPartial) {
      return 'Informe o produto em todos os itens.';
    }

    if (!allowPartial) {
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return 'A quantidade deve ser um numero inteiro maior que zero.';
      }
    }

    const productValue = Number(item.productValue);
    const passedValue = Number(item.passedValue ?? 0);
    const compraParaguai = item.compraParaguai;

    if (!Number.isFinite(productValue) || productValue < 0) {
      return 'O valor do produto deve ser um numero valido.';
    }

    if (!Number.isFinite(passedValue) || passedValue < 0) {
      return 'O valor repassado deve ser um numero valido.';
    }

    if (compraParaguai !== undefined && typeof compraParaguai !== 'boolean') {
      return 'O campo Compra Paraguai do item deve ser verdadeiro ou falso.';
    }
  }

  return '';
}

function canViewOrder(user, order) {
  return Boolean(user && order);
}

function parseItemsInput(rawItems) {
  if (Array.isArray(rawItems)) {
    return rawItems;
  }

  if (typeof rawItems === 'string') {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
}

function mapItemMediaUploads(files, totalItems) {
  const mediaMap = new Map();

  for (const file of files) {
    const match = /^(itemImage|itemVideo)_(\d+)$/.exec(String(file.fieldname || ''));

    if (!match) {
      continue;
    }

    const itemIndex = Number(match[2]);

    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= totalItems) {
      const rangeError = new Error('Mídia enviada para item invalido.');
      rangeError.statusCode = 400;
      throw rangeError;
    }

    const currentMedia = mediaMap.get(itemIndex) || {};

    if (match[1] === 'itemImage') {
      currentMedia.image = file;
    } else {
      currentMedia.video = file;
    }

    mediaMap.set(itemIndex, currentMedia);
  }

  return mediaMap;
}

function validateUploadedMediaSizes(files) {
  for (const file of files) {
    const fieldName = String(file.fieldname || '');

    if (fieldName.startsWith('itemImage_') && file.size > env.maxOrderImageFileSizeBytes) {
      return 'A imagem deve ter no maximo 5 MB.';
    }

    if (fieldName.startsWith('itemVideo_') && file.size > env.maxOrderVideoFileSizeBytes) {
      return 'O vídeo deve ter no maximo 25 MB.';
    }
  }

  return '';
}

async function cleanupUploadedFiles(files) {
  await Promise.all(
    files.map(async (file) => {
      if (!file?.path) {
        return;
      }

      try {
        await fs.unlink(file.path);
      } catch (_error) {
        // Ignora limpeza defensiva quando arquivo ja foi removido.
      }
    })
  );
}

async function createOrderHandler(request, response, next) {
  const uploadedFiles = request.files ?? [];

  try {
    const requestName = String(request.body?.requestName ?? '').trim();
    const buyerId = Number(request.body?.buyerId ?? 0) || null;
    const urgency = String(request.body?.urgency ?? 'normal').trim();
    const relatedOsRaw = String(request.body?.relatedOs ?? '').trim();
    const orcamento = parseBooleanInput(request.body?.orcamento, false);
    const items = parseItemsInput(request.body?.items);
    const mediaUploads = mapItemMediaUploads(uploadedFiles, items.length);
    const mediaSizeError = validateUploadedMediaSizes(uploadedFiles);

    if (mediaSizeError) {
      await cleanupUploadedFiles(uploadedFiles);
      response.status(400).json({
        error: mediaSizeError
      });
      return;
    }

    if (!requestName) {
      await cleanupUploadedFiles(uploadedFiles);
      response.status(400).json({
        error: 'Informe o nome do pedido.'
      });
      return;
    }

    if (!buyerId) {
      await cleanupUploadedFiles(uploadedFiles);
      response.status(400).json({
        error: 'Selecione um comprador.'
      });
      return;
    }

    if (!['normal', 'priority'].includes(urgency)) {
      await cleanupUploadedFiles(uploadedFiles);
      response.status(400).json({
        error: 'urgência invalida.'
      });
      return;
    }

    const relatedOsResult = parseRelatedOsInput(relatedOsRaw);

    const itemValidationError = validateItems(items);

    if (itemValidationError) {
      await cleanupUploadedFiles(uploadedFiles);
      response.status(400).json({
        error: itemValidationError
      });
      return;
    }

    const normalizedItems = items.map((item, itemIndex) => {
      const productValue = toCurrencyNumber(item.productValue);
      const compraParaguai = Boolean(item.compraParaguai);
      const saleValue = calculateSaleValue(productValue, compraParaguai);
      const itemMedia = mediaUploads.get(itemIndex) || {};

      return {
        productName: String(item.productName ?? '').trim(),
        productCode: String(item.productCode ?? '').trim(),
        productLink: String(item.productLink ?? '').trim(),
        notes: String(item.notes ?? '').trim(),
        compraParaguai,
        quantity: Number(item.quantity),
        productValue,
        saleValue,
        passedValue: toCurrencyNumber(saleValue * Number(item.quantity)),
        imageKey: itemMedia.image?.filename ?? null,
        imageMimeType: itemMedia.image?.mimetype ?? null,
        imageSizeBytes: Number(itemMedia.image?.size ?? 0) || null,
        videoKey: itemMedia.video?.filename ?? null,
        videoMimeType: itemMedia.video?.mimetype ?? null,
        videoSizeBytes: Number(itemMedia.video?.size ?? 0) || null
      };
    });

    const order = await createOrder({
      userId: request.user.id,
      requestName,
      buyerId,
      urgency,
      relatedOs: relatedOsResult.relatedOs,
      orcamento,
      items: normalizedItems
    });

    response.status(201).json({ order });
  } catch (error) {
    await cleanupUploadedFiles(uploadedFiles);
    next(error);
  }
}

async function getOrderItemMediaHandler(request, response, next) {
  try {
    const orderId = Number(request.params.id);
    const itemId = Number(request.params.itemId);
    const mediaKind = String(request.params.kind ?? '').trim();

    if (!Number.isInteger(orderId) || !Number.isInteger(itemId)) {
      response.status(400).json({
        error: 'Identificadores invalidos.'
      });
      return;
    }

    if (!['image', 'video'].includes(mediaKind)) {
      response.status(400).json({
        error: 'Tipo de mídia invalido.'
      });
      return;
    }

    const itemMedia = await getOrderItemMedia({ orderId, itemId });
    const mediaKey = mediaKind === 'video' ? itemMedia?.videoKey : itemMedia?.imageKey;
    const mediaMimeType = mediaKind === 'video' ? itemMedia?.videoMimeType : itemMedia?.imageMimeType;

    if (!mediaKey) {
      response.status(404).json({
        error: mediaKind === 'video' ? 'Vídeo nao encontrado para este item.' : 'Imagem nao encontrada para este item.'
      });
      return;
    }

    if (!canViewOrder(request.user, itemMedia)) {
      response.status(403).json({
        error: `Voce nao tem permissao para visualizar este ${mediaKind === 'video' ? 'vídeo' : 'arquivo'}.`
      });
      return;
    }

    const imagePath = resolveOrderImagePath(mediaKey);

    if (!imagePath) {
      response.status(404).json({
        error: mediaKind === 'video' ? 'Vídeo nao encontrado para este item.' : 'Imagem nao encontrada para este item.'
      });
      return;
    }

    try {
      await fs.access(imagePath);
    } catch (_error) {
      response.status(404).json({
        error: mediaKind === 'video' ? 'Vídeo nao encontrado para este item.' : 'Imagem nao encontrada para este item.'
      });
      return;
    }

    response.setHeader('Content-Type', mediaMimeType || 'application/octet-stream');
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.sendFile(imagePath);
  } catch (error) {
    next(error);
  }
}

async function listOrdersHandler(request, response, next) {
  try {
    const id = String(request.query?.id ?? '').trim();
    const status = String(request.query?.status ?? '').trim().toLowerCase();
    const requesterId = String(request.query?.requesterId ?? '').trim();
    const buyerId = String(request.query?.buyerId ?? '').trim();

    const orders = await listOrders({
      id,
      status,
      requesterId,
      buyerId
    });

    response.json({ orders });
  } catch (error) {
    next(error);
  }
}

async function getOrderDetailsHandler(request, response, next) {
  try {
    const order = await getOrderById(Number(request.params.id));

    if (!order) {
      response.status(404).json({
        error: 'Pedido nao encontrado.'
      });
      return;
    }

    if (!canViewOrder(request.user, order)) {
      response.status(403).json({
        error: 'Voce nao tem permissao para visualizar este pedido.'
      });
      return;
    }

    response.json({ order });
  } catch (error) {
    next(error);
  }
}

async function updateOrderHandler(request, response, next) {
  try {
    const orderId = Number(request.params.id);
    const buyerId = Number(request.body?.buyerId ?? 0) || null;
    const status = normalizeStatus(String(request.body?.status ?? '').trim().toLowerCase());
    const estimatedDelivery = String(request.body?.estimatedDelivery ?? '').trim();
    const comments = String(request.body?.comments ?? '').trim();
    const relatedOsRaw = String(request.body?.relatedOs ?? '').trim();
    const items = Array.isArray(request.body?.items) ? request.body.items : [];

    if (!buyerId) {
      response.status(400).json({
        error: 'Selecione um comprador.'
      });
      return;
    }

    if (!allowedStatuses.includes(status)) {
      response.status(400).json({
        error: 'Status invalido.'
      });
      return;
    }

    const itemValidationError = validateItems(items, true);

    if (itemValidationError) {
      response.status(400).json({
        error: itemValidationError
      });
      return;
    }

    const currentOrder = await getOrderById(orderId);

    if (!currentOrder) {
      response.status(404).json({
        error: 'Pedido nao encontrado.'
      });
      return;
    }

    if (currentOrder.status === 'finalizado' || currentOrder.status === 'cancelado') {
      response.status(409).json({
        error: 'Pedido finalizado ou cancelado nao pode ser alterado.'
      });
      return;
    }

    const relatedOsResult = parseRelatedOsInput(relatedOsRaw);

    const normalizedItems = items.map((item) => {
      const productValue = toCurrencyNumber(item.productValue);
      const compraParaguai = Boolean(item.compraParaguai);

      return {
        id: Number(item.id),
        productCode: String(item.productCode ?? '').trim(),
        productLink: String(item.productLink ?? '').trim(),
        compraParaguai,
        productValue,
        saleValue: calculateSaleValue(productValue, compraParaguai),
        passedValue: toCurrencyNumber(item.passedValue)
      };
    });

    const canUpdateOrder = true;

    if (!canUpdateOrder) {
      response.status(403).json({
        error: 'Voce nao tem permissao para alterar este pedido.'
      });
      return;
    }

    const order = await updateOrder(orderId, {
      userId: request.user.id,
      buyerId,
      status,
      estimatedDelivery: estimatedDelivery || null,
      comments,
      relatedOs: relatedOsResult.relatedOs,
      items: normalizedItems
    });
    response.json({ order });
  } catch (error) {
    next(error);
  }
}

async function deleteOrderHandler(request, response, next) {
  try {
    const orderId = Number(request.params.id);
    const currentOrder = await getOrderById(orderId);

    if (!currentOrder) {
      response.status(404).json({
        error: 'Pedido nao encontrado.'
      });
      return;
    }

    if (currentOrder.status === 'finalizado' || currentOrder.status === 'cancelado') {
      response.status(409).json({
        error: 'Pedido finalizado ou cancelado nao pode ser excluido.'
      });
      return;
    }

    const deleted = await deleteOrder(orderId);

    if (!deleted) {
      response.status(404).json({
        error: 'Pedido nao encontrado.'
      });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function reopenOrderHandler(request, response, next) {
  try {
    const orderId = Number(request.params.id);
    const reason = String(request.body?.reason ?? '').trim();

    if (!reason) {
      response.status(400).json({
        error: 'Informe o motivo da reabertura.'
      });
      return;
    }

    const result = await reopenOrder(orderId, {
      userId: request.user.id,
      reason
    });

    if (!result) {
      response.status(404).json({
        error: 'Pedido nao encontrado.'
      });
      return;
    }

    if (result.error === 'ORDER_NOT_FINISHED') {
      response.status(409).json({
        error: 'Somente pedidos finalizados ou cancelados podem ser reabertos.'
      });
      return;
    }

    response.json({ order: result });
  } catch (error) {
    next(error);
  }
}

export {
  createOrderHandler,
  deleteOrderHandler,
  getOrderItemMediaHandler,
  getOrderDetailsHandler,
  listOrdersHandler,
  reopenOrderHandler,
  updateOrderHandler
};
