-- Rename delivered orders to finalized and keep the column comment aligned.
UPDATE orders
SET status = 'finalizado'
WHERE status IN ('entregue', 'delivered');

COMMENT ON COLUMN orders.status IS
  'Status da ordem: pending, pendente, comprado/aguardando entrega, finalizado, email_pending, cancelado';