ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET password_change_required = TRUE
WHERE username = 'admin';
