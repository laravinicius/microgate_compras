-- Add support for budget (orcamento) order statuses.
-- This migration documents the new statuses and updates existing orders
-- marked as orcamento to use the new canonical status `em_orcamento`.

COMMENT ON COLUMN orders.status IS
  'Status da ordem: pending, pendente, em_orcamento, comprado/aguardando entrega, finalizado, email_pending, cancelado, aguardando_aprovacao_do_cliente';

-- Update existing orders that have the orcamento flag set and are still pending.
UPDATE orders
SET status = 'em_orcamento'
WHERE orcamento = TRUE
  AND status IN ('pending', 'pendente');
