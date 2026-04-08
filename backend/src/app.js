import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.frontendUrls.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origem CORS nao permitida: ${origin}`));
    },
    credentials: false
  })
);
app.use(express.json({ limit: '200kb' }));

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
  if (env.nodeEnv === 'production') {
    console.error(`[${new Date().toISOString()}] ${error?.message ?? 'Erro interno'}`);
  } else {
    console.error(error);
  }

  if (error?.code === '23505') {
    response.status(409).json({
      error: 'Ja existe um usuario com este nome de acesso.'
    });
    return;
  }

  if (error?.code === '23503') {
    response.status(409).json({
      error:
        'Operacao nao permitida porque existem registros relacionados a este item.'
    });
    return;
  }

  response.status(500).json({
    error: 'Erro interno do servidor.'
  });
});

export { app };
