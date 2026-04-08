ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS image_key VARCHAR(255);

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(80);

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS image_size_bytes INTEGER;

CREATE INDEX IF NOT EXISTS idx_order_items_image_key
ON order_items (image_key)
WHERE image_key IS NOT NULL;
