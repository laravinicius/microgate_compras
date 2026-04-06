CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT,
  email VARCHAR(120) UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'solicitante',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS username VARCHAR(80);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'solicitante';

UPDATE users
SET role = 'administrador'
WHERE role = 'admin';

UPDATE users
SET role = 'solicitante'
WHERE role = 'user';

UPDATE users
SET username = 'admin'
WHERE name = 'Administrador HML'
  AND (username IS NULL OR username = '');

UPDATE users
SET username = CONCAT('user_', id)
WHERE username IS NULL OR username = '';

ALTER TABLE users
ALTER COLUMN username SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_username_key'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email VARCHAR(120) UNIQUE;

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  request_name VARCHAR(180),
  urgency VARCHAR(20) NOT NULL DEFAULT 'normal',
  related_os INTEGER,
  without_os BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  estimated_delivery DATE,
  comments TEXT,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS request_name VARCHAR(180);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) NOT NULL DEFAULT 'normal';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS related_os INTEGER;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS without_os BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS estimated_delivery DATE;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS comments TEXT;

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_name VARCHAR(180) NOT NULL,
  product_link TEXT,
  notes TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  product_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sale_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  passed_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS passed_value NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE order_items
SET passed_value = sale_value * quantity
WHERE passed_value = 0;

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
  password_hash = 'microgate-admin:6c20e0d5e52c78dc7a0377003765a0672a172cf7fef2bdf195364d4dfb0a2392ad76fa310d242f5dadacc40b76c9162adff2c7ad3bbbc8c676d34d0ffd1bb745'
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
