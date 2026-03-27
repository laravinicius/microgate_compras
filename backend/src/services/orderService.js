import { pool } from '../config/db.js';

function normalizeOrder(row) {
  return {
    id: row.id,
    userId: row.user_id,
    requestName: row.request_name,
    urgency: row.urgency,
    relatedOs: row.related_os,
    withoutOs: row.without_os,
    status: row.status,
    total: Number(row.total),
    createdAt: row.created_at
  };
}

async function createOrder({ userId, requestName, urgency, relatedOs, withoutOs, items }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const total = items.reduce(
      (sum, item) => sum + Number(item.saleValue) * Number(item.quantity),
      0
    );

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
        RETURNING id, user_id, request_name, urgency, related_os, without_os, status, total, created_at
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
            sale_value
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          order.id,
          item.productName,
          item.productLink,
          item.notes,
          item.quantity,
          item.productValue,
          item.saleValue
        ]
      );
    }

    await client.query('COMMIT');

    return normalizeOrder(order);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export { createOrder };
