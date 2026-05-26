import { app } from './app.js';
import { env } from './config/env.js';
import { ensureOrderItemsFreteColumn } from './config/db.js';

try {
  await ensureOrderItemsFreteColumn();
} catch (error) {
  console.error('Falha ao garantir a coluna frete em order_items:', error);
  throw error;
}

app.listen(env.port, env.host, () => {
  console.log(`Backend rodando em http://${env.host}:${env.port}`);
});
