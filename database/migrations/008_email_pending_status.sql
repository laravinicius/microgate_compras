-- Add support for email_pending order status.
-- Current schema uses VARCHAR for orders.status, so no structural change is required.
-- This migration exists to document and standardize the new business status.

COMMENT ON COLUMN orders.status IS
  'Status da ordem: pending, comprado, waiting_delivery, delivered, email_pending, cancelado';
