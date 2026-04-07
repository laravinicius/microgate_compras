import dotenv from 'dotenv';

dotenv.config();

const defaultAuthSecret = 'troque-esta-chave-secreta-em-producao';
const nodeEnv = process.env.NODE_ENV ?? 'development';
const authSecret = process.env.AUTH_SECRET ?? defaultAuthSecret;

if (nodeEnv === 'production' && authSecret === defaultAuthSecret) {
  throw new Error('AUTH_SECRET deve ser definido em producao.');
}

const env = {
  nodeEnv,
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  smtpHost: process.env.SMTP_HOST ?? 'localhost',
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'noreply@microgate.local',
  enableEmail: process.env.ENABLE_EMAIL !== 'false',
  authSecret,
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/compras_db'
};

export { env };
