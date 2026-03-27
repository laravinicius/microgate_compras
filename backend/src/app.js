import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';

const app = express();

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: false
  })
);
app.use(express.json());

app.get('/', (_request, response) => {
  response.json({
    message: 'API do sistema de compras online.'
  });
});

app.use('/api', apiRouter);

app.use((request, response) => {
  response.status(404).json({
    error: `Rota nao encontrada: ${request.method} ${request.originalUrl}`
  });
});

app.use((error, _request, response, _next) => {
  console.error(error);

  if (error?.code === '23505') {
    response.status(409).json({
      error: 'Ja existe um usuario com este nome de acesso.'
    });
    return;
  }

  response.status(500).json({
    error: 'Erro interno do servidor.'
  });
});

export { app };
