-- Add Orçamento aprovado status documentation to orders.status
-- This migration updates the column comment to include the new status.
COMMENT ON COLUMN orders.status IS
  'Status da ordem: pending, pendente, em_orcamento, orcamento_aprovado, comprado/aguardando entrega, finalizado, email_pending, cancelado, aguardando_aprovacao_do_cliente';

-- Note: we intentionally do not modify existing rows. The new status
-- will be used by the application when a user explicitly changes it.
