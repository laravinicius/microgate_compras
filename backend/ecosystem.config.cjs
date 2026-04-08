const path = require('path');

module.exports = {
  apps: [
    {
      name: 'compras-backend',
      script: 'src/server.js',
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        FRONTEND_URLS:
          'https://compras.microgateinformatica.com.br,https://portal.microgateinformatica.com.br,https://restrito.microgateinformatica.com.br'
      }
    }
  ]
};
