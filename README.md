# Sistema de Compras Node.js

Estrutura inicial do novo sistema web separada em:

- `backend`: API REST em Node.js/Express com PostgreSQL
- `frontend`: aplicacao React com build estatico

## Estrutura

```text
.
├── backend
├── database
│   └── init.sql
├── frontend
└── DEPLOY_PRODUCAO.md
```

## Como rodar localmente

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API disponivel em `http://localhost:4000/api/health`.

Se for testar com o frontend Vite em outra maquina/dispositivo, ajuste `HOST` no `.env` do backend.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend de desenvolvimento disponivel em `http://localhost:5173`.

## Build do frontend

```bash
cd frontend
npm install
npm run build
```

Os arquivos gerados ficarao em `frontend/dist/` e devem ser servidos pelo Nginx em homologacao/producao.

## Banco de dados

Use o script [`database/init.sql`](/var/www/microgate_compras2/database/init.sql) para criar a estrutura inicial.

## PM2

Existe um arquivo opcional em [`backend/ecosystem.config.cjs`](/var/www/microgate_compras2/backend/ecosystem.config.cjs) para facilitar o uso futuro com PM2.

pm2 reload compras-backend