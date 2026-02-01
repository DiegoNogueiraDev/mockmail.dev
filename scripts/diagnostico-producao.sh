#!/bin/bash

# =============================================================================
# MockMail.dev - Script de Diagnóstico de Produção/Homologação
# =============================================================================
# Execute este script no servidor para diagnosticar problemas de 503
# Uso: bash diagnostico-producao.sh
# =============================================================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "============================================================================="
echo "  MockMail.dev - Diagnóstico de Produção"
echo "  Data: $(date)"
echo "  Hostname: $(hostname)"
echo "============================================================================="
echo -e "${NC}"

# Função para verificar status
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}[OK]${NC} $2"
    else
        echo -e "${RED}[FALHA]${NC} $2"
    fi
}

# Função para warning
check_warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

# =============================================================================
echo -e "\n${BLUE}=== 1. VERIFICANDO PROCESSOS PM2 ===${NC}\n"
# =============================================================================

if command -v pm2 &> /dev/null; then
    echo "PM2 está instalado"
    echo ""
    pm2 list
    echo ""

    # Verificar se os processos estão rodando
    BACKEND_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | contains("backend") or contains("api") or contains("mockmail")) | .pm2_env.status' 2>/dev/null | head -1)
    FRONTEND_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | contains("frontend") or contains("watch") or contains("dashboard")) | .pm2_env.status' 2>/dev/null | head -1)

    if [ "$BACKEND_STATUS" == "online" ]; then
        check_status 0 "Backend PM2 está online"
    else
        check_status 1 "Backend PM2 NÃO está online (status: $BACKEND_STATUS)"
    fi

    if [ "$FRONTEND_STATUS" == "online" ]; then
        check_status 0 "Frontend PM2 está online"
    else
        check_status 1 "Frontend PM2 NÃO está online (status: $FRONTEND_STATUS)"
    fi
else
    check_status 1 "PM2 não está instalado"
fi

# =============================================================================
echo -e "\n${BLUE}=== 2. VERIFICANDO PORTAS ===${NC}\n"
# =============================================================================

echo "Portas em uso relacionadas ao MockMail:"
echo ""

# Backend porta 3000 ou 3010
if ss -tlnp 2>/dev/null | grep -q ":3000 \|:3010 "; then
    check_status 0 "Backend escutando em porta 3000 ou 3010"
    ss -tlnp 2>/dev/null | grep -E ":3000 |:3010 " || true
else
    check_status 1 "Backend NÃO está escutando em porta 3000 ou 3010"
fi

echo ""

# Frontend porta 3001 ou 3011
if ss -tlnp 2>/dev/null | grep -q ":3001 \|:3011 "; then
    check_status 0 "Frontend escutando em porta 3001 ou 3011"
    ss -tlnp 2>/dev/null | grep -E ":3001 |:3011 " || true
else
    check_status 1 "Frontend NÃO está escutando em porta 3001 ou 3011"
fi

echo ""
echo "Todas as portas 3xxx em uso:"
ss -tlnp 2>/dev/null | grep ":3[0-9][0-9][0-9] " || echo "Nenhuma porta 3xxx em uso"

# =============================================================================
echo -e "\n${BLUE}=== 3. VERIFICANDO NGINX ===${NC}\n"
# =============================================================================

if systemctl is-active --quiet nginx 2>/dev/null; then
    check_status 0 "Nginx está rodando"
else
    check_status 1 "Nginx NÃO está rodando"
fi

# Verificar configuração do nginx
if command -v nginx &> /dev/null; then
    echo ""
    echo "Testando configuração do Nginx:"
    nginx -t 2>&1 || true

    echo ""
    echo "Sites habilitados:"
    ls -la /etc/nginx/sites-enabled/ 2>/dev/null || ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "Não encontrado"

    echo ""
    echo "Configuração do MockMail no Nginx (proxy_pass):"
    grep -rn "proxy_pass\|upstream" /etc/nginx/sites-enabled/ 2>/dev/null | head -20 || \
    grep -rn "proxy_pass\|upstream" /etc/nginx/conf.d/ 2>/dev/null | head -20 || \
    echo "Não encontrado"
fi

# =============================================================================
echo -e "\n${BLUE}=== 4. VERIFICANDO DOCKER ===${NC}\n"
# =============================================================================

if command -v docker &> /dev/null; then
    check_status 0 "Docker está instalado"

    echo ""
    echo "Containers rodando:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Erro ao listar containers"

    echo ""
    echo "Containers do MockMail (incluindo parados):"
    docker ps -a --filter "name=mockmail" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
    docker ps -a --filter "name=mongo" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
    docker ps -a --filter "name=redis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
else
    check_warning "Docker não está instalado"
fi

# =============================================================================
echo -e "\n${BLUE}=== 5. VERIFICANDO CONECTIVIDADE DOS SERVIÇOS ===${NC}\n"
# =============================================================================

# Testar backend
echo "Testando Backend (localhost:3000):"
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:3000/health 2>/dev/null)
if [ "$BACKEND_RESPONSE" == "200" ]; then
    check_status 0 "Backend respondendo em /health (HTTP 200)"
else
    BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:3000/ 2>/dev/null)
    if [[ "$BACKEND_RESPONSE" =~ ^(200|301|302|404)$ ]]; then
        check_status 0 "Backend respondendo (HTTP $BACKEND_RESPONSE)"
    else
        check_status 1 "Backend NÃO está respondendo em localhost:3000 (HTTP $BACKEND_RESPONSE)"
        echo "  Tentando porta 3010..."
        BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:3010/ 2>/dev/null)
        if [[ "$BACKEND_RESPONSE" =~ ^(200|301|302|404)$ ]]; then
            check_status 0 "Backend respondendo em localhost:3010 (HTTP $BACKEND_RESPONSE)"
        else
            check_status 1 "Backend NÃO está respondendo em nenhuma porta (HTTP $BACKEND_RESPONSE)"
        fi
    fi
fi

echo ""
echo "Testando Frontend (localhost:3001):"
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:3001/ 2>/dev/null)
if [[ "$FRONTEND_RESPONSE" =~ ^(200|301|302)$ ]]; then
    check_status 0 "Frontend respondendo (HTTP $FRONTEND_RESPONSE)"
else
    check_status 1 "Frontend NÃO está respondendo em localhost:3001 (HTTP $FRONTEND_RESPONSE)"
    echo "  Tentando porta 3011..."
    FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:3011/ 2>/dev/null)
    if [[ "$FRONTEND_RESPONSE" =~ ^(200|301|302)$ ]]; then
        check_status 0 "Frontend respondendo em localhost:3011 (HTTP $FRONTEND_RESPONSE)"
    else
        check_status 1 "Frontend NÃO está respondendo em nenhuma porta (HTTP $FRONTEND_RESPONSE)"
    fi
fi

# =============================================================================
echo -e "\n${BLUE}=== 6. VERIFICANDO MONGODB E REDIS ===${NC}\n"
# =============================================================================

# MongoDB
echo "MongoDB:"
if command -v mongosh &> /dev/null; then
    if mongosh --eval "db.runCommand({ ping: 1 })" --quiet 2>/dev/null | grep -q "ok"; then
        check_status 0 "MongoDB conectando localmente"
    else
        check_status 1 "MongoDB NÃO está acessível localmente"
    fi
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qi mongo; then
    check_status 0 "MongoDB rodando via Docker"
    docker ps --filter "name=mongo" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null
else
    check_warning "MongoDB não encontrado localmente - verificar se está em outro servidor"
fi

echo ""
echo "Redis:"
if command -v redis-cli &> /dev/null; then
    if redis-cli ping 2>/dev/null | grep -q "PONG"; then
        check_status 0 "Redis conectando localmente"
    else
        check_status 1 "Redis NÃO está acessível localmente"
    fi
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qi redis; then
    check_status 0 "Redis rodando via Docker"
    docker ps --filter "name=redis" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null
else
    check_warning "Redis não encontrado localmente - verificar se está em outro servidor"
fi

# =============================================================================
echo -e "\n${BLUE}=== 7. LOGS RECENTES ===${NC}\n"
# =============================================================================

echo "Últimas linhas dos logs PM2 (se existirem):"
echo ""

# Encontrar diretório PM2
PM2_LOG_DIR="$HOME/.pm2/logs"
if [ ! -d "$PM2_LOG_DIR" ]; then
    PM2_LOG_DIR="/root/.pm2/logs"
fi

if [ -d "$PM2_LOG_DIR" ]; then
    # Logs de erro do backend
    BACKEND_ERR=$(ls -t "$PM2_LOG_DIR"/*backend*-error*.log "$PM2_LOG_DIR"/*api*-error*.log "$PM2_LOG_DIR"/*mockmail*-error*.log 2>/dev/null | head -1)
    if [ -n "$BACKEND_ERR" ] && [ -f "$BACKEND_ERR" ]; then
        echo "=== Backend Error Log (últimas 30 linhas): $BACKEND_ERR ==="
        tail -30 "$BACKEND_ERR"
        echo ""
    fi

    # Logs de output do backend
    BACKEND_OUT=$(ls -t "$PM2_LOG_DIR"/*backend*-out*.log "$PM2_LOG_DIR"/*api*-out*.log "$PM2_LOG_DIR"/*mockmail*-out*.log 2>/dev/null | head -1)
    if [ -n "$BACKEND_OUT" ] && [ -f "$BACKEND_OUT" ]; then
        echo "=== Backend Output Log (últimas 30 linhas): $BACKEND_OUT ==="
        tail -30 "$BACKEND_OUT"
        echo ""
    fi

    # Logs de erro do frontend
    FRONTEND_ERR=$(ls -t "$PM2_LOG_DIR"/*frontend*-error*.log "$PM2_LOG_DIR"/*watch*-error*.log "$PM2_LOG_DIR"/*dashboard*-error*.log 2>/dev/null | head -1)
    if [ -n "$FRONTEND_ERR" ] && [ -f "$FRONTEND_ERR" ]; then
        echo "=== Frontend Error Log (últimas 30 linhas): $FRONTEND_ERR ==="
        tail -30 "$FRONTEND_ERR"
        echo ""
    fi
else
    echo "Diretório de logs PM2 não encontrado"
fi

# Logs do Nginx
if [ -f /var/log/nginx/error.log ]; then
    echo "=== Nginx Error Log (últimas 20 linhas) ==="
    sudo tail -20 /var/log/nginx/error.log 2>/dev/null || tail -20 /var/log/nginx/error.log 2>/dev/null || echo "Sem permissão para ler logs do Nginx"
    echo ""
fi

# =============================================================================
echo -e "\n${BLUE}=== 8. VERIFICANDO ARQUIVOS .ENV ===${NC}\n"
# =============================================================================

echo "Procurando arquivos .env do projeto..."

# Encontrar diretório do projeto
PROJECT_DIR=$(find /home /var/www /opt -maxdepth 4 -type d -name "mockmail*" 2>/dev/null | head -1)
if [ -z "$PROJECT_DIR" ]; then
    PROJECT_DIR=$(pwd)
fi

echo "Diretório do projeto: $PROJECT_DIR"
echo ""

# Backend .env
if [ -f "$PROJECT_DIR/backend/.env" ]; then
    check_status 0 "Backend .env encontrado"
    echo "  Variáveis configuradas (valores ocultos):"
    grep -E "^[A-Z_]+=" "$PROJECT_DIR/backend/.env" 2>/dev/null | sed 's/=.*/=***/' | sed 's/^/    /'
else
    check_status 1 "Backend .env NÃO encontrado em $PROJECT_DIR/backend/.env"
fi

echo ""

# Frontend .env
FRONTEND_ENV=""
for env_file in "$PROJECT_DIR/frontend/.env.local" "$PROJECT_DIR/frontend/.env.production" "$PROJECT_DIR/frontend/.env" "$PROJECT_DIR/watch/.env.local" "$PROJECT_DIR/watch/.env"; do
    if [ -f "$env_file" ]; then
        FRONTEND_ENV="$env_file"
        break
    fi
done

if [ -n "$FRONTEND_ENV" ]; then
    check_status 0 "Frontend .env encontrado: $FRONTEND_ENV"
    echo "  Variáveis configuradas (valores ocultos):"
    grep -E "^[A-Z_]+=" "$FRONTEND_ENV" 2>/dev/null | sed 's/=.*/=***/' | sed 's/^/    /'
else
    check_status 1 "Frontend .env NÃO encontrado"
fi

# =============================================================================
echo -e "\n${BLUE}=== 9. USO DE RECURSOS ===${NC}\n"
# =============================================================================

echo "Memória:"
free -h

echo ""
echo "Disco:"
df -h / | head -5

echo ""
echo "CPU Load:"
uptime

echo ""
echo "Processos Node.js rodando:"
ps aux | grep -E "[n]ode|[n]pm" | awk '{print $2, $11, $12, $13}' | head -10 || echo "Nenhum processo Node.js encontrado"

# =============================================================================
echo -e "\n${BLUE}=== 10. RESUMO E RECOMENDAÇÕES ===${NC}\n"
# =============================================================================

echo "============================================================================="
echo "RESUMO DO DIAGNÓSTICO"
echo "============================================================================="
echo ""

# Coletar problemas
PROBLEMS=()

# Verificar PM2
if ! command -v pm2 &> /dev/null; then
    PROBLEMS+=("PM2 não está instalado")
elif ! pm2 list 2>/dev/null | grep -qE "online"; then
    PROBLEMS+=("Nenhum processo PM2 está online")
fi

# Verificar portas
if ! ss -tlnp 2>/dev/null | grep -qE ":3000 |:3010 "; then
    PROBLEMS+=("Backend não está escutando em porta 3000 ou 3010")
fi

if ! ss -tlnp 2>/dev/null | grep -qE ":3001 |:3011 "; then
    PROBLEMS+=("Frontend não está escutando em porta 3001 ou 3011")
fi

# Verificar Nginx
if ! systemctl is-active --quiet nginx 2>/dev/null; then
    PROBLEMS+=("Nginx não está rodando")
fi

# Mostrar resultado
if [ ${#PROBLEMS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ Nenhum problema óbvio detectado nos serviços.${NC}"
    echo ""
    echo "Se ainda está vendo 503, o problema pode ser:"
    echo "  1. Configuração incorreta do proxy_pass no Nginx"
    echo "  2. Nginx apontando para porta errada"
    echo "  3. Firewall bloqueando conexões internas"
    echo "  4. Timeout de conexão entre Nginx e aplicação"
    echo ""
    echo "Verifique a configuração do Nginx com:"
    echo "  cat /etc/nginx/sites-enabled/mockmail* ou similar"
else
    echo -e "${RED}✗ Problemas encontrados:${NC}"
    echo ""
    for problem in "${PROBLEMS[@]}"; do
        echo "  • $problem"
    done
    echo ""
    echo -e "${YELLOW}Comandos sugeridos para correção:${NC}"
    echo ""
    echo "  # Ver status detalhado do PM2"
    echo "  pm2 status"
    echo ""
    echo "  # Reiniciar todos os processos PM2"
    echo "  pm2 restart all"
    echo ""
    echo "  # Se PM2 não tem processos, redeployar"
    echo "  cd $PROJECT_DIR && ./deploy.sh --env=homologacao"
    echo ""
    echo "  # Verificar logs em tempo real"
    echo "  pm2 logs"
    echo ""
    echo "  # Reiniciar Nginx"
    echo "  sudo systemctl restart nginx"
fi

echo ""
echo "============================================================================="
echo "Diagnóstico concluído em $(date)"
echo "============================================================================="
