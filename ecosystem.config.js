module.exports = {
  apps: [
    {
      name: 'mockmail-api-hml',
      cwd: './backend',
      script: 'dist/server.js',
      interpreter: '/home/anaopcd/.nvm/versions/node/v24.13.0/bin/node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3010
      }
    },
    {
      name: 'mockmail-frontend-hml',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3011',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3011
      }
    }
  ]
};
