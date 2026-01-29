module.exports = {
  apps: [
    {
      name: 'mockmail-api',
      cwd: '/home/anaopcd/mockmail/api',
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
      error_file: '/home/anaopcd/.pm2/logs/mockmail-api-error.log',
      out_file: '/home/anaopcd/.pm2/logs/mockmail-api-out.log',
      time: true
    },
    {
      name: 'mockmail-watch',
      cwd: '/home/anaopcd/mockmail/watch',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/home/anaopcd/.pm2/logs/mockmail-watch-error.log',
      out_file: '/home/anaopcd/.pm2/logs/mockmail-watch-out.log',
      time: true
    }
  ]
};
