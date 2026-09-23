CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT,
  password_change_required BOOLEAN NOT NULL DEFAULT FALSE,
  email VARCHAR(120) UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'solicitante',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  buyer_id INTEGER REFERENCES users (id),
  request_name VARCHAR(180),
  urgency VARCHAR(20) NOT NULL DEFAULT 'normal',
  related_os INTEGER,
  without_os BOOLEAN NOT NULL DEFAULT FALSE,
  orcamento BOOLEAN NOT NULL DEFAULT FALSE,
  compra_paraguai BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  estimated_delivery DATE,
  comments TEXT,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_name VARCHAR(180) NOT NULL,
  product_code VARCHAR(120),
  product_link TEXT,
  notes TEXT,
  compra_paraguai BOOLEAN NOT NULL DEFAULT FALSE,
  quantity INTEGER NOT NULL DEFAULT 1,
  product_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sale_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  passed_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  frete NUMERIC(12, 2) NOT NULL DEFAULT 0,
  image_key VARCHAR(255),
  image_mime_type VARCHAR(80),
  image_size_bytes INTEGER,
  video_key VARCHAR(255),
  video_mime_type VARCHAR(80),
  video_size_bytes INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id),
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_comments_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION set_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_orders_updated_at();

INSERT INTO users (name, username)
VALUES ('Administrador HML', 'admin')
ON CONFLICT (username) DO NOTHING;

UPDATE users
SET
  role = 'administrador',
  password_hash = 'microgate-admin:6c20e0d5e52c78dc7a0377003765a0672a172cf7fef2bdf195364d4dfb0a2392ad76fa310d242f5dadacc40b76c9162adff2c7ad3bbbc8c676d34d0ffd1bb745',
  password_change_required = TRUE
WHERE username = 'admin';

INSERT INTO orders (user_id, status, total)
SELECT id, 'pending', 150.00
FROM users
WHERE username = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM orders
    WHERE user_id = users.id
  );
