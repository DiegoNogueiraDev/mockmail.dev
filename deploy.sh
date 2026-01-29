#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   MockMail - Deploy Script${NC}"
echo -e "${GREEN}========================================${NC}\n"

# 1. Pull latest changes
echo -e "${YELLOW}1. Atualizando código do repositório...${NC}"
git pull origin main || git pull origin master
echo -e "${GREEN}✓ Código atualizado${NC}\n"

# 2. Install/Update dependencies
echo -e "${YELLOW}2. Instalando dependências...${NC}"
cd api && npm install && npm run build
echo -e "${GREEN}✓ API dependencies installed and built${NC}"

cd ../watch && npm install && npm run build
echo -e "${GREEN}✓ Watch dependencies installed and built${NC}\n"

# 3. Restart PM2 services
echo -e "${YELLOW}3. Reiniciando serviços PM2...${NC}"
cd ..
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}✓ Serviços reiniciados${NC}\n"

# 4. Verify services
echo -e "${YELLOW}4. Verificando serviços...${NC}"
sleep 3
pm2 status

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Deploy concluído com sucesso!${NC}"
echo -e "${GREEN}========================================${NC}\n"
echo -e "API: http://localhost:3000/api/health"
echo -e "Watch: http://localhost:3001"
echo -e "Dashboard: https://watch.mockmail.dev\n"
