-- Merge purchased and waiting delivery statuses into a single status.
UPDATE orders
SET status = 'comprado/aguardando entrega'
WHERE status IN ('comprado', 'purchased', 'aguardando entrega', 'waiting_delivery');

COMMENT ON COLUMN orders.status IS
  'Status da ordem: pending, pendente, comprado/aguardando entrega, delivered, entregue, email_pending, cancelado';
