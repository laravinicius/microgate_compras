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
        TRUST_PROXY: '1'
      },
      env_hml: {
        FRONTEND_URLS: 'http://192.168.101.43,http://192.168.101.43:8081'
      },
      env_prd: {
        FRONTEND_URLS:
          'https://compras.microgateinformatica.com.br,https://portal.microgateinformatica.com.br,https://restrito.microgateinformatica.com.br,http://192.168.101.42,http://192.168.101.42:8081'
      }
    }
  ]
};
