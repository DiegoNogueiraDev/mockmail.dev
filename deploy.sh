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

# 2. Install/Update API dependencies
echo -e "${YELLOW}2. Instalando dependências da API...${NC}"
cd api
npm install
npm run build
echo -e "${GREEN}✓ API atualizada${NC}\n"

# 3. Install/Update Watch dependencies  
echo -e "${YELLOW}3. Instalando dependências do Watch...${NC}"
cd ../watch
npm install
npm run build
echo -e "${GREEN}✓ Watch atualizado${NC}\n"

# 4. Update Email Processor if needed
echo -e "${YELLOW}4. Atualizando Email Processor...${NC}"
cd ../email-processor
if [ -f "email_processor.py" ]; then
    sudo cp email_processor.py /opt/mockmail/
    echo -e "${GREEN}✓ Email processor atualizado${NC}"
fi
if [ -f "email-handler.sh" ]; then
    sudo cp email-handler.sh /usr/local/bin/
    sudo chmod +x /usr/local/bin/email-handler.sh
    echo -e "${GREEN}✓ Email handler atualizado${NC}"
fi
echo ""

# 5. Restart PM2 services
echo -e "${YELLOW}5. Reiniciando serviços PM2...${NC}"
cd ..
pm2 restart all
echo -e "${GREEN}✓ PM2 reiniciado${NC}\n"

# 6. Restart Email Processor if running
echo -e "${YELLOW}6. Reiniciando Email Processor...${NC}"
if sudo systemctl is-active --quiet email-processor; then
    sudo systemctl restart email-processor
    echo -e "${GREEN}✓ Email processor reiniciado${NC}"
else
    echo -e "${YELLOW}⚠ Email processor não está rodando${NC}"
fi
echo ""

# 7. Verify services
echo -e "${YELLOW}7. Verificando serviços...${NC}"
sleep 3

# Check PM2
PM2_STATUS=$(pm2 jlist | jq '[.[] | select(.pm2_env.status=="online")] | length')
PM2_TOTAL=$(pm2 jlist | jq 'length')
echo -e "PM2: ${GREEN}$PM2_STATUS/$PM2_TOTAL${NC} online"

# Check API
if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "API: ${GREEN}✓ OK${NC}"
else
    echo -e "API: ${RED}✗ FAILED${NC}"
fi

# Check Watch
if curl -s -f http://localhost:3001 > /dev/null 2>&1; then
    echo -e "Watch: ${GREEN}✓ OK${NC}"
else
    echo -e "Watch: ${RED}✗ FAILED${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Deploy concluído!${NC}"
echo -e "${GREEN}========================================${NC}\n"
echo -e "API: http://localhost:3000/api/health"
echo -e "Watch: http://localhost:3001"
echo -e "Dashboard: https://watch.mockmail.dev"
echo -e "\nPara ver logs: ${YELLOW}pm2 logs${NC}\n"
