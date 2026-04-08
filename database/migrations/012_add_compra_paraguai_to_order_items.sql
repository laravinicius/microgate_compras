-- Move Compra Paraguai granularity from order to item.
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS compra_paraguai BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve previous behavior for legacy data where the flag existed only on the order.
UPDATE order_items oi
SET compra_paraguai = TRUE
FROM orders o
WHERE oi.order_id = o.id
  AND o.compra_paraguai = TRUE
  AND oi.compra_paraguai = FALSE;
