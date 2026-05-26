-- Add frete column to order_items (total freight per item)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS frete NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Ensure index if needed in future; keep simple for now.
