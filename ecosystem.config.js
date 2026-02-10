/**
 * MockMail.dev - PM2 Ecosystem Configuration
 * 
 * Este arquivo define TODOS os serviços gerenciados pelo PM2:
 * - API Produção (porta 3000)
 * - API Homologação (porta 3010)
 * - Frontend Produção (porta 3001)
 * - Frontend Homologação (porta 3011)
 * - Email Processor (único - distribui para ambos os ambientes)
 * 
 * Uso:
 *   pm2 start ecosystem.config.js                    # Inicia todos
 *   pm2 start ecosystem.config.js --only mockmail-api  # Inicia só produção API
 *   pm2 restart ecosystem.config.js                  # Reinicia todos
 */

module.exports = {
  apps: [
    // ============================================
    // PRODUÇÃO
    // ============================================
    {
      name: 'mockmail-api',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN || ''
      }
    },
    {
      name: 'mockmail-frontend',
      cwd: './frontend',
      script: '.next/standalone/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },

    // ============================================
    // HOMOLOGAÇÃO
    // ============================================
    {
      name: 'mockmail-api-hml',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
        INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN || ''
      }
    },
    {
      name: 'mockmail-frontend-hml',
      cwd: './frontend',
      script: '.next/standalone/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3011
      }
    },

    // ============================================
    // EMAIL PROCESSOR (ÚNICO - distribui para HML e PROD)
    // ============================================
    {
      name: 'mockmail-processor',
      cwd: './backend',
      script: 'dist/emailProcessor.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        MOCKMAIL_FIFO_PATH: '/var/spool/email-processor',
        MOCKMAIL_DEBUG: 'true',
        INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN || '',
        HML_API_PORT: '3010',
        PROD_API_PORT: '3000',
        HML_ENABLED: 'true',
        PROD_ENABLED: 'true'
      }
    }
  ]
};
