#!/bin/bash

set -e

echo "🚀 Starting MockMail Dashboard deployment..."

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project directory."
    exit 1
fi

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the application
echo "🔨 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Verificar se os logs directory existem
sudo mkdir -p /var/log/mockmail
sudo chown $(whoami):$(whoami) /var/log/mockmail

# Stop existing PM2 process if running
echo "🛑 Stopping existing dashboard process..."
pm2 stop mockmail-watch 2>/dev/null || true
pm2 delete mockmail-watch 2>/dev/null || true

# Start the application with PM2
echo "▶️  Starting dashboard with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo ""
echo "✅ MockMail Dashboard deployed successfully!"
echo ""
echo "📊 Dashboard is running on: http://localhost:3001"
echo "🌐 If HAProxy is configured, it should be available at: https://watch.mockmail.dev"
echo ""
echo "📝 Useful commands:"
echo "   pm2 logs mockmail-watch    # View logs"
echo "   pm2 restart mockmail-watch # Restart dashboard"
echo "   pm2 stop mockmail-watch    # Stop dashboard"
echo "   pm2 status                 # Check all PM2 processes"
echo ""

# Show PM2 status
pm2 status

echo ""
echo "🔧 Next steps:"
echo "1. Update your HAProxy configuration with the contents of haproxy.cfg"
echo "2. Reload HAProxy: sudo systemctl reload haproxy"
echo "3. Make sure DNS for watch.mockmail.dev points to your server"
