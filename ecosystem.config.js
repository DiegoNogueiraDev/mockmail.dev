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
    },
    {
      name: 'mockmail-processor-hml',
      cwd: './backend',
      script: 'dist/emailProcessor.js',
      interpreter: '/home/anaopcd/.nvm/versions/node/v24.13.0/bin/node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        MOCKMAIL_FIFO_PATH: '/var/spool/email-processor',
        MOCKMAIL_OUTPUT_FILE: '/var/log/mockmail/emails.json',
        MOCKMAIL_POLL_INTERVAL: '1000',
        MOCKMAIL_DEBUG: 'true'
      }
    }
  ]
};
