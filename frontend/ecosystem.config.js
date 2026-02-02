module.exports = {
  apps: [{
    name: 'mockmail-watch',
    script: 'npm',
    args: 'start',
    cwd: '/home/anaopcd/mockmail-watch',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOSTNAME: '0.0.0.0'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOSTNAME: '0.0.0.0'
    },
    error_file: '/var/log/mockmail/dashboard-error.log',
    out_file: '/var/log/mockmail/dashboard-out.log',
    log_file: '/var/log/mockmail/dashboard.log',
    time: true
  }]
};
