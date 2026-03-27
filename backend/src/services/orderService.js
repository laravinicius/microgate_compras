import { pool } from '../config/db.js';

function normalizeOrder(row) {
  return {
    id: row.id,
    userId: row.user_id,
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

async function insertOrderHistory(client, { orderId, userId, description }) {
  await client.query(
    `
      INSERT INTO order_history (order_id, user_id, description)
      VALUES ($1, $2, $3)
    `,
    [orderId, userId, description]
  );
}

async function listOrders(searchTerm = '') {
  const normalizedSearch = searchTerm.trim();
  const hasSearch = normalizedSearch.length > 0;
  const searchValue = `%${normalizedSearch}%`;
  const params = hasSearch
    ? [searchValue, /^\d+$/.test(normalizedSearch) ? Number(normalizedSearch) : null]
    : [];

  const result = await pool.query(
    `
      SELECT
        o.id,
        o.user_id,
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
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${
        hasSearch
          ? `
      WHERE
        o.request_name ILIKE $1
        OR o.status ILIKE $1
        OR ($2::integer IS NOT NULL AND o.id = $2::integer)
      `
          : ''
      }
      GROUP BY
        o.id,
        o.user_id,
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

  return {
    ...normalizeOrder({
      ...order,
      items_count: itemsResult.rowCount
    }),
    items: itemsResult.rows.map(normalizeOrderItem)
    ,
    history: historyResult.rows.map(normalizeOrderHistory)
  };
}

async function createOrder({ userId, requestName, urgency, relatedOs, withoutOs, items }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const total = items.reduce((sum, item) => sum + Number(item.passedValue), 0);

    const orderResult = await client.query(
      `
        INSERT INTO orders (
          user_id,
          request_name,
          urgency,
          related_os,
          without_os,
          status,
          total
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', $6)
        RETURNING
          id,
          user_id,
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
      [userId, requestName, urgency, relatedOs, withoutOs, total]
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

async function updateOrder(orderId, { userId, status, estimatedDelivery, comments, items }) {
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
          status = $2,
          estimated_delivery = $3,
          comments = $4,
          total = $5
        WHERE id = $1
        RETURNING id
      `,
      [orderId, status, estimatedDelivery, comments, total]
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
        `Previsao de entrega alterada para "${estimatedDelivery || 'sem data'}".`
      );
    }

    if ((currentOrder.comments || '') !== (comments || '')) {
      historyEntries.push('Comentarios atualizados.');
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
