import { createOrder } from '../services/orderService.js';

function toCurrencyNumber(value) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return NaN;
  }

  return Number(normalizedValue.toFixed(2));
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Adicione ao menos um item na solicitacao.';
  }

  for (const item of items) {
    if (!String(item.productName ?? '').trim()) {
      return 'Informe o produto em todos os itens.';
    }

    const quantity = Number(item.quantity);
    const productValue = Number(item.productValue);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return 'A quantidade deve ser um numero inteiro maior que zero.';
    }

    if (!Number.isFinite(productValue) || productValue < 0) {
      return 'O valor do produto deve ser um numero valido.';
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
        error: 'Urgencia invalida.'
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

    const normalizedItems = items.map((item) => ({
      productName: String(item.productName ?? '').trim(),
      productLink: String(item.productLink ?? '').trim(),
      notes: String(item.notes ?? '').trim(),
      quantity: Number(item.quantity),
      productValue: toCurrencyNumber(item.productValue),
      saleValue: toCurrencyNumber(Number(item.productValue) * 1.7)
    }));

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

export { createOrderHandler };
