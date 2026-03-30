ALTER TABLE users
ALTER COLUMN role SET DEFAULT 'solicitante';

UPDATE users
SET role = 'administrador'
WHERE role = 'admin';

UPDATE users
SET role = 'solicitante'
WHERE role = 'user';

UPDATE users
SET role = 'administrador'
WHERE username = 'admin';
