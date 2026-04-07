# Microgate Compras

Aplicacao de gestao de solicitacoes de compra, com frontend em React (Vite) e backend em Node.js/Express usando PostgreSQL.

## Visao geral

- Backend: API REST com autenticacao, controle por perfil, historico de pedidos e envio opcional de email.
- Frontend: interface unica para login, criacao/edicao de pedidos, acompanhamento, historico e administracao de usuarios.
- Banco: script inicial completo em `database/init.sql` e migracoes incrementais em `database/migrations`.

## Estrutura do repositorio

```text
.
├── backend/
│   ├── ecosystem.config.cjs
│   ├── package.json
│   └── src/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
├── database/
│   ├── init.sql
│   └── migrations/
├── deploy.md
└── README.md
```

## Requisitos

- Node.js 18+
- npm 9+
- PostgreSQL 13+

## Setup local rapido

### 1) Banco de dados

Crie o banco e aplique o script base:

```bash
createdb compras_db
psql -d compras_db -f database/init.sql
```

Se estiver atualizando um banco antigo, aplique tambem as migracoes de `database/migrations` em ordem numerica.

### 2) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API local:

- `http://127.0.0.1:4000/`
- `http://127.0.0.1:4000/api/health`

### 3) Frontend

Em outro terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend local:

- `http://localhost:5173`

## Variaveis de ambiente

### Backend (`backend/.env`)

Baseado em `backend/.env.example`:

- `NODE_ENV` (ex.: `development` | `production`)
- `HOST` (padrao local: `127.0.0.1`)
- `PORT` (padrao: `4000`)
- `FRONTEND_URL` (origem permitida no CORS e base de links de email)
- `DATABASE_URL` (conexao PostgreSQL)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (email)
- `ENABLE_EMAIL` (`true`/`false`)
- `AUTH_SECRET` (obrigatorio em producao com valor forte)

Observacoes importantes:

- Em producao, o backend nao inicia se `AUTH_SECRET` estiver no valor padrao inseguro.
- Nao versione `.env` real com credenciais.

### Frontend (`frontend/.env`)

Baseado em `frontend/.env.example`:

- `VITE_API_BASE_URL` (padrao recomendado: `/api`)

No desenvolvimento, o Vite faz proxy de `/api` para `http://localhost:4000`.

## Scripts

### Backend (`backend/package.json`)

- `npm run dev`: sobe servidor com watch em `src/server.js`
- `npm start`: sobe servidor sem watch
- `npm run check`: validacao sintatica de `src/server.js`

### Frontend (`frontend/package.json`)

- `npm run dev`: inicia Vite em `0.0.0.0:5173`
- `npm run build`: gera build de producao em `frontend/dist`
- `npm run preview`: preview local do build

### Raiz do projeto

O `package.json` da raiz nao possui scripts de build/check do projeto.

## API (resumo)

Prefixo base: `/api`

Publicas:

- `GET /health`
- `POST /auth/login` (com rate limit)

Autenticadas:

- `GET /auth/me`
- `PUT /auth/password`
- `GET /orders`
- `GET /orders/:id`
- `POST /orders`
- `PUT /orders/:id`
- `PUT /orders/:id/reopen`
- `DELETE /orders/:id` (somente administrador)
- `GET /users` (somente administrador)
- `POST /users`
- `PUT /users/:id`
- `DELETE /users/:id`

## Perfis e regras

Perfis usados pelo sistema:

- `administrador`
- `comprador`
- `solicitante`

Regras gerais:

- Rotas de pedidos e usuarios exigem autenticacao.
- Usuario com troca de senha pendente nao pode seguir ate alterar senha.
- `GET /users` e exclusao de pedidos sao restritos a administrador.
- Escopo de visualizacao de pedido depende do perfil (admin/comprador/solicitante).

## Build e deploy

Build do frontend:

```bash
cd frontend
npm run build
```

Saida: `frontend/dist`.

Em producao, a recomendacao e:

- Backend via PM2 (ex.: app `compras-backend`)
- Nginx servindo `frontend/dist`
- Proxy de `/api` para backend em `127.0.0.1:4000`

Guia operacional completo (homologacao -> producao): `deploy.md`.

## Verificacao rapida

Depois de subir backend e frontend localmente:

1. Acesse `GET /api/health` e valide retorno com `status: ok`.
2. Faça login com um usuario existente no banco.
3. Crie/edite um pedido e confirme listagem/historico.
4. Gere o build com `npm run build` em `frontend`.