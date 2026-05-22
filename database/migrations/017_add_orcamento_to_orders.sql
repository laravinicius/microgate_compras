-- Add Orcamento flag to orders.
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS orcamento BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE orders
SET orcamento = FALSE
WHERE orcamento IS NULL;