import {
  createOrder,
  deleteOrder,
  getOrderById,
  listOrders,
  updateOrder
} from '../services/orderService.js';
import {
  isAdministrator,
  isBuyer,
  isRequester
} from '../middlewares/authMiddleware.js';

const allowedStatuses = [
  'pendente',
  'comprado',
  'aguardando entrega',
  'entregue',
  'cancelado'
];

function toCurrencyNumber(value) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return NaN;
  }

  return Number(normalizedValue.toFixed(2));
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

    if (!Number.isFinite(productValue) || productValue < 0) {
      return 'O valor do produto deve ser um numero valido.';
    }

    if (!Number.isFinite(passedValue) || passedValue < 0) {
      return 'O valor repassado deve ser um numero valido.';
    }
  }

  return '';
}

async function createOrderHandler(request, response, next) {
  try {
    const requestName = String(request.body?.requestName ?? '').trim();
    const urgency = String(request.body?.urgency ?? 'normal').trim();
    const withoutOs = Boolean(request.body?.withoutOs);
    const relatedOsRaw = String(request.body?.relatedOs ?? '').trim();
    const items = Array.isArray(request.body?.items) ? request.body.items : [];

    if (!requestName) {
      response.status(400).json({
        error: 'Informe o nome do pedido.'
      });
      return;
    }

    if (!['normal', 'priority'].includes(urgency)) {
      response.status(400).json({
        error: 'urgência invalida.'
      });
      return;
    }

    if (!withoutOs && !/^\d+$/.test(relatedOsRaw)) {
      response.status(400).json({
        error: 'Informe apenas numeros na OS relacionada ou marque "sem OS".'
      });
      return;
    }

    const itemValidationError = validateItems(items);

    if (itemValidationError) {
      response.status(400).json({
        error: itemValidationError
      });
      return;
    }

    const normalizedItems = items.map((item) => {
      const productValue = toCurrencyNumber(item.productValue);
      const saleValue = toCurrencyNumber(Number(item.productValue) * 1.7);

      return {
        productName: String(item.productName ?? '').trim(),
        productLink: String(item.productLink ?? '').trim(),
        notes: String(item.notes ?? '').trim(),
        quantity: Number(item.quantity),
        productValue,
        saleValue,
        passedValue: toCurrencyNumber(saleValue * Number(item.quantity))
      };
    });

    const order = await createOrder({
      userId: request.user.id,
      requestName,
      urgency,
      relatedOs: withoutOs ? null : Number(relatedOsRaw),
      withoutOs,
      items: normalizedItems
    });

    response.status(201).json({ order });
  } catch (error) {
    next(error);
  }
}

async function listOrdersHandler(request, response, next) {
  try {
    const id = String(request.query?.id ?? '').trim();
    const status = String(request.query?.status ?? '').trim().toLowerCase();
    const requesterId = String(request.query?.requesterId ?? '').trim();
    const orders = await listOrders({
      id,
      status,
      requesterId
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

    response.json({ order });
  } catch (error) {
    next(error);
  }
}

async function updateOrderHandler(request, response, next) {
  try {
    const orderId = Number(request.params.id);
    const status = String(request.body?.status ?? '').trim().toLowerCase();
    const estimatedDelivery = String(request.body?.estimatedDelivery ?? '').trim();
    const comments = String(request.body?.comments ?? '').trim();
    const items = Array.isArray(request.body?.items) ? request.body.items : [];

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

    const normalizedItems = items.map((item) => ({
      id: Number(item.id),
      productValue: toCurrencyNumber(item.productValue),
      saleValue: toCurrencyNumber(Number(item.productValue) * 1.7),
      passedValue: toCurrencyNumber(item.passedValue)
    }));

    const currentOrder = await getOrderById(orderId);

    if (!currentOrder) {
      response.status(404).json({
        error: 'Pedido nao encontrado.'
      });
      return;
    }

    const canUpdateOrder =
      isAdministrator(request.user) ||
      isBuyer(request.user) ||
      (isRequester(request.user) && currentOrder.userId === request.user.id);

    if (!canUpdateOrder) {
      response.status(403).json({
        error: 'Voce nao tem permissao para alterar este pedido.'
      });
      return;
    }

    const order = await updateOrder(orderId, {
      userId: request.user.id,
      status,
      estimatedDelivery: estimatedDelivery || null,
      comments,
      items: normalizedItems
    });
    response.json({ order });
  } catch (error) {
    next(error);
  }
}

async function deleteOrderHandler(request, response, next) {
  try {
    const deleted = await deleteOrder(Number(request.params.id));

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

export {
  createOrderHandler,
  deleteOrderHandler,
  getOrderDetailsHandler,
  listOrdersHandler,
  updateOrderHandler
};
