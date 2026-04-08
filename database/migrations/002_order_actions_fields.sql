ALTER TABLE orders
ADD COLUMN IF NOT EXISTS estimated_delivery DATE;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS comments TEXT;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS passed_value NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE order_items
SET passed_value = sale_value * quantity
WHERE passed_value = 0;
