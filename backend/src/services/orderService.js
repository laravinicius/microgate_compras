import { pool } from '../config/db.js';

const statusAliases = {
  pendente: ['pendente', 'pending'],
  pending: ['pendente', 'pending'],
  comprado: ['comprado', 'purchased'],
  purchased: ['comprado', 'purchased'],
  'aguardando entrega': ['aguardando entrega', 'waiting_delivery'],
  waiting_delivery: ['aguardando entrega', 'waiting_delivery'],
  entregue: ['entregue', 'delivered'],
  delivered: ['entregue', 'delivered'],
  cancelado: ['cancelado', 'cancelled'],
  cancelled: ['cancelado', 'cancelled']
};

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
    status: row.status,
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
  const normalizedStatus = String(filters.status ?? '').trim();
  const normalizedRequesterId = String(filters.requesterId ?? '').trim();
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

async function createOrder({ userId, buyerId, requestName, urgency, relatedOs, withoutOs, items }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const total = items.reduce((sum, item) => sum + Number(item.passedValue), 0);

    const orderResult = await client.query(
      `
        INSERT INTO orders (
          user_id,
          buyer_id,
          request_name,
          urgency,
          related_os,
          without_os,
          status,
          total
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING
          id,
          user_id,
          buyer_id,
          request_name,
          urgency,
          related_os,
          without_os,
          status,
          estimated_delivery,
          comments,
          total,
          created_at,
          updated_at
      `,
      [userId, buyerId, requestName, urgency, relatedOs, withoutOs, total]
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
            quantity,
            product_value,
            sale_value,
            passed_value
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          order.id,
          item.productName,
          item.productLink,
          item.notes,
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

    return getOrderById(order.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateOrder(orderId, { userId, buyerId, status, estimatedDelivery, comments, items }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentOrder = await getOrderById(orderId);

    if (!currentOrder) {
      await client.query('ROLLBACK');
      return null;
    }

    const total = items.reduce((sum, item) => sum + Number(item.passedValue), 0);

    const orderResult = await client.query(
      `
        UPDATE orders
        SET
          buyer_id = $2,
          status = $3,
          estimated_delivery = $4,
          comments = $5,
          total = $6
        WHERE id = $1
        RETURNING id
      `,
      [orderId, buyerId, status, estimatedDelivery, comments, total]
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
            passed_value = $4
          WHERE id = $1
        `,
        [item.id, item.productValue, item.saleValue, item.passedValue]
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

export { createOrder, deleteOrder, getOrderById, listOrders, updateOrder };
