# Deploy HML -> PRD

Este documento descreve como replicar em producao o ambiente validado em homologacao no Ubuntu.

Padrao definido para facilitar a replica:

- HML: preferencialmente usar o mesmo caminho final
- PRD: `/var/www/microgate_compras`
- Banco de dados: por enquanto HML e PRD usam o mesmo banco atual

Observacao importante:

- O ideal e que o HML tambem passe a usar `/var/www/microgate_compras`
- Mais adiante, quando existir um banco exclusivo para HML, basta trocar apenas a `DATABASE_URL` do backend

## 1. Estrutura esperada

Em ambos os ambientes, mantenha a mesma estrutura:

```text
/var/www/microgate_compras
├── backend
├── frontend
└── database
```

## 2. Backend

### Instalar dependencias

No HML:

```bash
cd /var/www/microgate_compras/backend
cp .env.example .env
npm install
```

Repita no PRD apos publicar os arquivos:

```bash
cd /var/www/microgate_compras/backend
npm install --omit=dev
```

### Variaveis de ambiente

Arquivo: `/var/www/microgate_compras/backend/.env`

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
FRONTEND_URL=https://compras.seudominio.com.br
DATABASE_URL=postgresql://usuario:senha@IP_DO_SERVIDOR_BANCO:5432/compras_db
```

Observacoes:

- `PORT=4000` deve ficar acessivel apenas localmente
- `DATABASE_URL` deve apontar para o servidor PostgreSQL remoto
- Neste momento, HML e PRD podem usar o mesmo banco atual
- Quando existir um banco especifico de HML, altere somente a `DATABASE_URL` do HML

### Rodar com PM2

Instalacao global do PM2:

```bash
npm install -g pm2
```

Inicializacao do backend:

```bash
cd /var/www/microgate_compras/backend
pm2 start src/server.js --name compras-backend
pm2 save
pm2 startup
```

Opcional com arquivo de configuracao:

```bash
cd /var/www/microgate_compras/backend
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Depois do `pm2 startup`, o Ubuntu exibira um comando adicional com `sudo`.
Esse comando deve ser executado para habilitar a subida automatica no boot.

Comandos uteis:

```bash
pm2 status
pm2 logs compras-backend
pm2 restart compras-backend
pm2 stop compras-backend
```

Boa pratica:

- Nao use `npm run dev` em producao
- Em homologacao e producao, rode o backend pelo PM2

## 3. Frontend

### Instalar dependencias e gerar build

Em HML:

```bash
cd /var/www/microgate_compras/frontend
cp .env.example .env
npm install
npm run build
```

Em PRD:

```bash
cd /var/www/microgate_compras/frontend
npm install
npm run build
```

O build sera gerado em:

```text
/var/www/microgate_compras/frontend/dist
```

### Onde servir os arquivos

Configure o Nginx para apontar o `root` para:

```text
/var/www/microgate_compras/frontend/dist
```

Isso garante que a rota `/` carregue o frontend estatico, sem `npm run dev`.

## 4. PostgreSQL

### Banco remoto

Neste momento, o backend conecta em um PostgreSQL que fica em outro servidor.
Por isso, o ponto principal e garantir que a `DATABASE_URL` esteja correta no arquivo `.env`.

Exemplo:

```env
DATABASE_URL=postgresql://compras_user:troque_esta_senha@192.168.101.60:5432/compras_db
```

Observacoes:

- O servidor PostgreSQL deve aceitar conexoes a partir do servidor Ubuntu onde o Node.js esta rodando
- Se houver firewall, a porta `5432` precisa estar liberada entre os servidores
- Se futuramente houver um banco separado de HML, altere apenas a `DATABASE_URL` do HML

### Criar tabelas iniciais

Execute o script abaixo no banco atual:

Arquivo: [`database/init.sql`](/var/www/microgate_compras2/database/init.sql)

Exemplo:

```bash
psql -h IP_DO_SERVIDOR_BANCO -U compras_user -d compras_db -f /var/www/microgate_compras/database/init.sql
```

### Configurar a conexao no backend

No arquivo `.env` do backend:

```env
DATABASE_URL=postgresql://compras_user:troque_esta_senha@IP_DO_SERVIDOR_BANCO:5432/compras_db
```

## 5. Nginx

O Nginx nao executa Node.js. Ele deve:

- servir os arquivos estaticos do frontend
- encaminhar `/api` para o backend Node.js em `127.0.0.1:4000`

### Exemplo de server block

```nginx
server {
    listen 80;
    server_name compras.seudominio.com.br;

    root /var/www/microgate_compras/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Observacao importante:

- Se quiser manter o prefixo `/api`, a API Node deve expor as rotas com `/api`
- Neste projeto atual, o backend ja responde em `/api/health`

### Ativar site no Nginx

Exemplo para Ubuntu:

```bash
sudo nano /etc/nginx/sites-available/microgate_compras
sudo ln -s /etc/nginx/sites-available/microgate_compras /etc/nginx/sites-enabled/microgate_compras
sudo nginx -t
sudo systemctl reload nginx
```

Se o arquivo ja existir em `sites-available`, apenas valide e recarregue:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Fluxo recomendado HML -> PRD

1. Publicar o codigo em HML.
2. Configurar `.env` do backend e frontend no HML.
3. Validar se a `DATABASE_URL` do HML aponta corretamente para o banco atual.
4. Executar `database/init.sql` no banco, se necessario.
5. Rodar `npm install` no backend e frontend.
6. Gerar `npm run build` no frontend.
7. Subir backend com PM2 na porta `4000`.
8. Configurar Nginx do HML apontando `/` para `frontend/dist` e `/api` para `127.0.0.1:4000`.
9. Validar o funcionamento completo em HML.
10. Replicar os mesmos passos em PRD.
11. Ajustar somente dominio, arquivo `.env` e eventuais credenciais especificas.

## 7. Checklist final

- API responde em `http://127.0.0.1:4000/api/health`
- Frontend carrega pela raiz `/`
- Frontend exibe status retornado pela API
- Nginx entrega os arquivos de `frontend/dist`
- Nginx encaminha `/api` para o backend
- Backend nao fica exposto publicamente em outra porta
- Apenas portas `80` e `443` ficam abertas externamente
- PM2 inicia o backend automaticamente apos reboot
- O arquivo `.env` do backend aponta para o banco correto

## 8. Boas praticas

- Nunca rode `npm run dev` em producao
- No Ubuntu, mantenha o backend escutando apenas em `127.0.0.1:4000`
- Versione apenas `.env.example`, nunca o `.env` real
- Valide `nginx -t` antes de recarregar o servico
- Enquanto HML e PRD usarem o mesmo banco, trate os testes de HML com cuidado para nao afetar dados reais

## 9. Preparacao futura

### Separar banco de HML

Quando voce criar um banco proprio de homologacao:

1. Crie o novo banco.
2. Execute o script [`database/init.sql`](/var/www/microgate_compras2/database/init.sql).
3. Altere a `DATABASE_URL` do HML.
4. Reinicie o backend no PM2:

```bash
cd /var/www/microgate_compras/backend
pm2 restart compras-backend
```

### PM2

O projeto ja esta preparado para uso com PM2 porque o backend inicia com:

```bash
node src/server.js
```

### Docker

Para futuro uso com Docker, a separacao atual ajuda bastante:

- `backend` isolado
- `frontend` com build estatico
- `database` com SQL inicial
- Nginx podendo virar container separado ou continuar no host
