import {
  createOrder,
  deleteOrder,
  getOrderItemImage,
  getOrderById,
  listOrders,
  reopenOrder,
  updateOrder
} from '../services/orderService.js';
import {
  isAdministrator,
  isBuyer,
  isRequester
} from '../middlewares/authMiddleware.js';
import { resolveOrderImagePath } from '../utils/orderImageStorage.js';
import fs from 'fs/promises';

const allowedStatuses = [
  'pendente',
  'comprado/aguardando entrega',
  'comprado',
  'aguardando entrega',
  'finalizado',
  'cancelado'
];

function normalizeStatus(status) {
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
  if (!user || !order) {
    return false;
  }

  if (isAdministrator(user)) {
    return true;
  }

  if (isBuyer(user)) {
    return Number(user.id) === Number(order.buyerId);
  }

  if (isRequester(user)) {
    return Number(user.id) === Number(order.userId);
  }

  return false;
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

function mapItemImageUploads(files, totalItems) {
  const imageMap = new Map();

  for (const file of files) {
    const match = /^itemImage_(\d+)$/.exec(String(file.fieldname || ''));

    if (!match) {
      continue;
    }

    const itemIndex = Number(match[1]);

    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= totalItems) {
      const rangeError = new Error('Imagem enviada para item invalido.');
      rangeError.statusCode = 400;
      throw rangeError;
    }

    imageMap.set(itemIndex, file);
  }

  return imageMap;
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
    const items = parseItemsInput(request.body?.items);
    const imageUploads = mapItemImageUploads(uploadedFiles, items.length);

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
      const imageUpload = imageUploads.get(itemIndex);

      return {
        productName: String(item.productName ?? '').trim(),
        productLink: String(item.productLink ?? '').trim(),
        notes: String(item.notes ?? '').trim(),
        compraParaguai,
        quantity: Number(item.quantity),
        productValue,
        saleValue,
        passedValue: toCurrencyNumber(saleValue * Number(item.quantity)),
        imageKey: imageUpload?.filename ?? null,
        imageMimeType: imageUpload?.mimetype ?? null,
        imageSizeBytes: Number(imageUpload?.size ?? 0) || null
      };
    });

    const order = await createOrder({
      userId: request.user.id,
      requestName,
      buyerId,
      urgency,
      relatedOs: relatedOsResult.relatedOs,
      items: normalizedItems
    });

    response.status(201).json({ order });
  } catch (error) {
    await cleanupUploadedFiles(uploadedFiles);
    next(error);
  }
}

async function getOrderItemImageHandler(request, response, next) {
  try {
    const orderId = Number(request.params.id);
    const itemId = Number(request.params.itemId);

    if (!Number.isInteger(orderId) || !Number.isInteger(itemId)) {
      response.status(400).json({
        error: 'Identificadores invalidos.'
      });
      return;
    }

    const itemImage = await getOrderItemImage({ orderId, itemId });

    if (!itemImage?.imageKey) {
      response.status(404).json({
        error: 'Imagem nao encontrada para este item.'
      });
      return;
    }

    if (!canViewOrder(request.user, itemImage)) {
      response.status(403).json({
        error: 'Voce nao tem permissao para visualizar esta imagem.'
      });
      return;
    }

    const imagePath = resolveOrderImagePath(itemImage.imageKey);

    if (!imagePath) {
      response.status(404).json({
        error: 'Imagem nao encontrada para este item.'
      });
      return;
    }

    try {
      await fs.access(imagePath);
    } catch (_error) {
      response.status(404).json({
        error: 'Imagem nao encontrada para este item.'
      });
      return;
    }

    response.setHeader('Content-Type', itemImage.imageMimeType || 'application/octet-stream');
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
  getOrderItemImageHandler,
  getOrderDetailsHandler,
  listOrdersHandler,
  reopenOrderHandler,
  updateOrderHandler
};
