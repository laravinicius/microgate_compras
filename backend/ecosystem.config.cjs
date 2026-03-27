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
        NODE_ENV: 'production'
      }
    }
  ]
};
