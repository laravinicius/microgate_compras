import { pool } from '../config/db.js';
import { sendBuyerNotification } from '../utils/email.js';

const statusAliases = {
  pendente: ['pendente', 'pending'],
  'comprado/aguardando entrega': [
    'comprado/aguardando entrega',
    'comprado',
    'purchased',
    'aguardando entrega',
    'waiting_delivery'
  ],
  finalizado: ['finalizado', 'entregue', 'delivered'],
  cancelado: ['cancelado', 'cancelled'],
  email_pending: ['email_pending', 'pendente email']
};

const statusCanonicalMap = {
  pending: 'pendente',
  pendente: 'pendente',
  purchased: 'comprado/aguardando entrega',
  comprado: 'comprado/aguardando entrega',
  'aguardando entrega': 'comprado/aguardando entrega',
  waiting_delivery: 'comprado/aguardando entrega',
  'comprado/aguardando entrega': 'comprado/aguardando entrega',
  delivered: 'finalizado',
  entregue: 'finalizado',
  finalizado: 'finalizado',
  cancelled: 'cancelado',
  cancelado: 'cancelado',
  email_pending: 'email_pending',
  'pendente email': 'email_pending'
};

function normalizeOrderStatus(status) {
  const normalizedStatus = String(status ?? '').trim().toLowerCase();

  return statusCanonicalMap[normalizedStatus] || normalizedStatus;
}

function normalizeOrder(row) {
  return {
    id: row.id,
    userId: row.user_id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    buyerUsername: row.buyer_username,
    requesterName: row.requester_name,
    requesterUsername: row.requester_username,
    requestName: row.request_name,
    urgency: row.urgency,
    relatedOs: row.related_os,
    withoutOs: row.without_os,
    compraParaguai: Boolean(row.compra_paraguai),
    status: normalizeOrderStatus(row.status),
    estimatedDelivery: row.estimated_delivery,
    comments: row.comments ?? '',
    total: Number(row.total),
    itemsCount: Number(row.items_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeOrderItem(row) {
  return {
    id: row.id,
    productName: row.product_name,
    productLink: row.product_link ?? '',
    notes: row.notes ?? '',
    compraParaguai: Boolean(row.compra_paraguai),
    quantity: Number(row.quantity),
    productValue: Number(row.product_value),
    saleValue: Number(row.sale_value),
    passedValue: Number(row.passed_value)
  };
}

function normalizeOrderHistory(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    name: row.name,
    description: row.description,
    createdAt: row.created_at
  };
}

function normalizeOrderComment(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    name: row.name,
    comment: row.comment,
    createdAt: row.created_at
  };
}

function formatOrderOsLabel(relatedOs, withoutOs) {
  if (withoutOs || relatedOs === null || relatedOs === undefined || relatedOs === '') {
    return 'sem OS';
  }

  return String(relatedOs);
}

async function insertOrderHistory(client, { orderId, userId, description }) {
  await client.query(
    `
      INSERT INTO order_history (order_id, user_id, description)
      VALUES ($1, $2, $3)
    `,
    [orderId, userId, description]
  );
}

async function insertOrderComment(client, { orderId, userId, comment }) {
  await client.query(
    `
      INSERT INTO order_comments_history (order_id, user_id, comment)
      VALUES ($1, $2, $3)
    `,
    [orderId, userId, comment]
  );
}

async function listOrders(filters = {}) {
  const normalizedId = String(filters.id ?? '').trim();
  const normalizedStatus = normalizeOrderStatus(filters.status);
  const normalizedRequesterId = String(filters.requesterId ?? '').trim();
  const normalizedBuyerId = String(filters.buyerId ?? '').trim();
  const whereClauses = [];
  const params = [];

  if (/^\d+$/.test(normalizedId)) {
    params.push(Number(normalizedId));
    whereClauses.push(`o.id = $${params.length}`);
  }

  if (normalizedStatus) {
    const acceptedStatuses = statusAliases[normalizedStatus] || [normalizedStatus];
    params.push(acceptedStatuses);
    whereClauses.push(`o.status = ANY($${params.length}::text[])`);
  }

  if (/^\d+$/.test(normalizedRequesterId)) {
    params.push(Number(normalizedRequesterId));
    whereClauses.push(`o.user_id = $${params.length}`);
  }

  if (/^\d+$/.test(normalizedBuyerId)) {
    params.push(Number(normalizedBuyerId));
    whereClauses.push(`o.buyer_id = $${params.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        o.id,
        o.user_id,
        o.buyer_id,
        b.name AS buyer_name,
        b.username AS buyer_username,
        u.name AS requester_name,
        u.username AS requester_username,
        o.request_name,
        o.urgency,
        o.related_os,
        o.without_os,
        o.compra_paraguai,
        o.status,
        o.estimated_delivery,
        o.comments,
        o.total,
        o.created_at,
        o.updated_at,
        COUNT(oi.id) AS items_count
      FROM orders o
      INNER JOIN users u ON u.id = o.user_id
      LEFT JOIN users b ON b.id = o.buyer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      GROUP BY
        o.id,
        o.user_id,
        o.buyer_id,
        b.name,
        b.username,
        u.name,
        u.username,
        o.request_name,
        o.urgency,
        o.related_os,
        o.without_os,
        o.compra_paraguai,
        o.status,
        o.estimated_delivery,
        o.comments,
        o.total,
        o.created_at,
        o.updated_at
      ORDER BY o.updated_at DESC, o.id DESC
    `,
    params
  );

  return result.rows.map(normalizeOrder);
}

async function getOrderById(orderId) {
  const orderResult = await pool.query(
    `
      SELECT
        o.id,
        o.user_id,
        o.buyer_id,
        b.name AS buyer_name,
        b.username AS buyer_username,
        u.name AS requester_name,
        u.username AS requester_username,
        o.request_name,
        o.urgency,
        o.related_os,
        o.without_os,
        o.compra_paraguai,
        o.status,
        o.estimated_delivery,
        o.comments,
        o.total,
        o.created_at,
        o.updated_at
      FROM orders o
      INNER JOIN users u ON u.id = o.user_id
      LEFT JOIN users b ON b.id = o.buyer_id
      WHERE o.id = $1
    `,
    [orderId]
  );

  const order = orderResult.rows[0];

  if (!order) {
    return null;
  }

  const itemsResult = await pool.query(
    `
      SELECT
        id,
        product_name,
        product_link,
        notes,
        compra_paraguai,
        quantity,
        product_value,
        sale_value,
        passed_value
      FROM order_items
      WHERE order_id = $1
      ORDER BY id ASC
    `,
    [orderId]
  );

  const historyResult = await pool.query(
    `
      SELECT
        oh.id,
        oh.order_id,
        oh.user_id,
        oh.description,
        oh.created_at,
        u.username,
        u.name
      FROM order_history oh
      INNER JOIN users u ON u.id = oh.user_id
      WHERE oh.order_id = $1
      ORDER BY oh.created_at DESC, oh.id DESC
    `,
    [orderId]
  );

  const commentsHistoryResult = await pool.query(
    `
      SELECT
        och.id,
        och.order_id,
        och.user_id,
        och.comment,
        och.created_at,
        u.username,
        u.name
      FROM order_comments_history och
      INNER JOIN users u ON u.id = och.user_id
      WHERE och.order_id = $1
      ORDER BY och.created_at DESC, och.id DESC
    `,
    [orderId]
  );

  return {
    ...normalizeOrder({
      ...order,
      items_count: itemsResult.rowCount
    }),
    items: itemsResult.rows.map(normalizeOrderItem),
    history: historyResult.rows.map(normalizeOrderHistory),
    commentsHistory: commentsHistoryResult.rows.map(normalizeOrderComment)
  };
}

async function createOrder({
  userId,
  buyerId,
  requestName,
  urgency,
  relatedOs,
  items
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const total = items.reduce((sum, item) => sum + Number(item.passedValue), 0);
    const hasCompraParaguai = items.some((item) => Boolean(item.compraParaguai));

    const orderResult = await client.query(
      `
        INSERT INTO orders (
          user_id,
          buyer_id,
          request_name,
          urgency,
          related_os,
          without_os,
          compra_paraguai,
          status,
          total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
        RETURNING
          id,
          user_id,
          buyer_id,
          request_name,
          urgency,
          related_os,
          without_os,
          compra_paraguai,
          status,
          estimated_delivery,
          comments,
          total,
          created_at,
          updated_at
      `,
      [
        userId,
        buyerId,
        requestName,
        urgency,
        relatedOs,
        relatedOs === null || relatedOs === undefined,
        hasCompraParaguai,
        total
      ]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `
          INSERT INTO order_items (
            order_id,
            product_name,
            product_link,
            notes,
            compra_paraguai,
            quantity,
            product_value,
            sale_value,
            passed_value
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          order.id,
          item.productName,
          item.productLink,
          item.notes,
          Boolean(item.compraParaguai),
          item.quantity,
          item.productValue,
          item.saleValue,
          item.passedValue
        ]
      );
    }

    await insertOrderHistory(client, {
      orderId: order.id,
      userId,
      description: 'Pedido criado.'
    });

    await client.query('COMMIT');

    const fullOrder = await getOrderById(order.id);

    // Disparo assíncrono para não bloquear a criação da ordem.
    void (async () => {
      if (!buyerId || !fullOrder) {
        return;
      }

      try {
        const buyerResult = await pool.query(
          `
            SELECT name, email
            FROM users
            WHERE id = $1
          `,
          [buyerId]
        );

        const buyer = buyerResult.rows[0];

        // Sem email cadastrado: ignorar silenciosamente.
        if (!buyer?.email) {
          return;
        }

        const sent = await sendBuyerNotification({
          buyerEmail: buyer.email,
          buyerName: buyer.name,
          orderId: fullOrder.id,
          orderData: {
            items: fullOrder.items,
            total: fullOrder.total,
            urgency,
            requesterName: fullOrder.requesterName,
            createdAt: fullOrder.createdAt
          }
        });

        if (!sent) {
          await pool.query(
            `
              UPDATE orders
              SET status = 'email_pending'
              WHERE id = $1
            `,
            [fullOrder.id]
          );
        }
      } catch (emailError) {
        console.error('[Email] Erro no fluxo de notificacao:', emailError);

        try {
          await pool.query(
            `
              UPDATE orders
              SET status = 'email_pending'
              WHERE id = $1
            `,
            [order.id]
          );
        } catch (statusError) {
          console.error(
            '[Email] Falha ao atualizar status para email_pending:',
            statusError
          );
        }
      }
    })();

    return fullOrder;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateOrder(
  orderId,
  { userId, buyerId, status, estimatedDelivery, comments, relatedOs, items }
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentOrder = await getOrderById(orderId);

    if (!currentOrder) {
      await client.query('ROLLBACK');
      return null;
    }

    const total = items.reduce((sum, item) => sum + Number(item.passedValue), 0);
    const hasCompraParaguai = items.some((item) => Boolean(item.compraParaguai));
    const withoutOs = relatedOs === null || relatedOs === undefined || relatedOs === '';

    const orderResult = await client.query(
      `
        UPDATE orders
        SET
          buyer_id = $2,
          status = $3,
          estimated_delivery = $4,
          comments = $5,
          related_os = $6,
          without_os = $7,
          compra_paraguai = $8,
          total = $9
        WHERE id = $1
        RETURNING id
      `,
      [
        orderId,
        buyerId,
        status,
        estimatedDelivery,
        comments,
        relatedOs,
        withoutOs,
        hasCompraParaguai,
        total
      ]
    );

    if (!orderResult.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }

    for (const item of items) {
      await client.query(
        `
          UPDATE order_items
          SET
            product_value = $2,
            sale_value = $3,
            passed_value = $4,
            compra_paraguai = $5
          WHERE id = $1
        `,
        [item.id, item.productValue, item.saleValue, item.passedValue, Boolean(item.compraParaguai)]
      );
    }

    const historyEntries = [];

    if (currentOrder.status !== status) {
      historyEntries.push(
        `Status alterado de "${currentOrder.status}" para "${status}".`
      );
    }

    if ((currentOrder.estimatedDelivery || '') !== (estimatedDelivery || '')) {
      historyEntries.push(
        `Previsão de entrega alterada para "${estimatedDelivery || 'sem data'}".`
      );
    }

    if ((currentOrder.comments || '') !== (comments || '')) {
      const normalizedComment = String(comments || '').trim();

      if (normalizedComment) {
        await insertOrderComment(client, {
          orderId,
          userId,
          comment: normalizedComment
        });
      }
    }

    if (Number(currentOrder.buyerId || 0) !== Number(buyerId || 0)) {
      historyEntries.push('Comprador alterado.');
    }

    if (formatOrderOsLabel(currentOrder.relatedOs, currentOrder.withoutOs) !== formatOrderOsLabel(relatedOs, withoutOs)) {
      historyEntries.push(
        `OS alterada de "${formatOrderOsLabel(currentOrder.relatedOs, currentOrder.withoutOs)}" para "${formatOrderOsLabel(relatedOs, withoutOs)}".`
      );
    }

    for (const item of items) {
      const previousItem = currentOrder.items.find((currentItem) => currentItem.id === item.id);

      if (!previousItem) {
        continue;
      }

      if (Number(previousItem.productValue) !== Number(item.productValue)) {
        historyEntries.push(
          `Item "${previousItem.productName}": valor do produto alterado para ${item.productValue.toFixed(2)}.`
        );
      }

      if (Number(previousItem.passedValue) !== Number(item.passedValue)) {
        historyEntries.push(
          `Item "${previousItem.productName}": valor repassado alterado para ${item.passedValue.toFixed(2)}.`
        );
      }

      if (Boolean(previousItem.compraParaguai) !== Boolean(item.compraParaguai)) {
        historyEntries.push(
          `Item "${previousItem.productName}": Compra Paraguai ${Boolean(item.compraParaguai) ? 'ativada' : 'desativada'}.`
        );
      }
    }

    if (historyEntries.length === 0) {
      historyEntries.push('Pedido salvo sem alteracoes relevantes.');
    }

    for (const description of historyEntries) {
      await insertOrderHistory(client, {
        orderId,
        userId,
        description
      });
    }

    await client.query('COMMIT');

    return getOrderById(orderId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function reopenOrder(orderId, { userId, reason }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentOrder = await getOrderById(orderId);

    if (!currentOrder) {
      await client.query('ROLLBACK');
      return null;
    }

    if (currentOrder.status !== 'finalizado' && currentOrder.status !== 'cancelado') {
      await client.query('ROLLBACK');
      return {
        error: 'ORDER_NOT_FINISHED'
      };
    }

    const normalizedReason = String(reason ?? '').trim();

    await client.query(
      `
        UPDATE orders
        SET status = 'pendente'
        WHERE id = $1
      `,
      [orderId]
    );

    await insertOrderComment(client, {
      orderId,
      userId,
      comment: normalizedReason
    });

    await insertOrderHistory(client, {
      orderId,
      userId,
      description: `Status alterado de "${currentOrder.status}" para "pendente" por reabertura.`
    });

    await client.query('COMMIT');

    return getOrderById(orderId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteOrder(orderId) {
  const result = await pool.query(
    `
      DELETE FROM orders
      WHERE id = $1
      RETURNING id
    `,
    [orderId]
  );

  return Boolean(result.rowCount);
}

export {
  createOrder,
  deleteOrder,
  getOrderById,
  listOrders,
  reopenOrder,
  updateOrder
};
