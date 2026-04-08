import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port, env.host, () => {
  console.log(`Backend rodando em http://${env.host}:${env.port}`);
});
