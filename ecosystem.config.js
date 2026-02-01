// =============================================================================
// PM2 Ecosystem Config - MockMail.dev
// =============================================================================
// Este arquivo é gerado automaticamente pelo deploy.sh
// Para personalizar, edite o deploy.sh
// =============================================================================

module.exports = {
  apps: [
    {
      name: 'mockmail-api',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      time: true
    },
    {
      name: 'mockmail-frontend',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      time: true
    }
  ]
};
