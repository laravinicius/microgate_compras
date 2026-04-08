-- Add flag to identify Paraguay purchase pricing.
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS compra_paraguai BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE orders
SET compra_paraguai = FALSE
WHERE compra_paraguai IS NULL;
