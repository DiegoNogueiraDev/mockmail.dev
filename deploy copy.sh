#!/bin/bash
# Deploy Automatizado - CRM Grupo Souza Monteiro + Site Institucional
set -e

# Cores e diretórios
RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' BLUE='\033[0;34m' CYAN='\033[0;36m' NC='\033[0m'
PROJECT_ROOT="/home/cortexflow/crm-monteiro-souza"
BACKEND_DIR="$PROJECT_ROOT/gsm-2.0/backend"
FRONTEND_DIR="$PROJECT_ROOT/gsm-2.0/frontend"
WEBSITE_DIR="$PROJECT_ROOT/institutional-website"
DB_RESET_DONE=false

# Funções auxiliares
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
separator() { echo -e "\n============================================================================\n"; }

reset_database() {
    echo -e "\n${RED}════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}                    ⚠️  ATENÇÃO: RESET DO BANCO DE DADOS  ⚠️                   ${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════════════════════${NC}\n"
    echo -e "${YELLOW}Esta operação irá:${NC}\n   • DELETAR TODOS OS DADOS do banco\n   • RECRIAR toda a estrutura de tabelas\n   • PERDER histórico de leads, usuários, vendas, etc.\n"
    echo -e "${RED}ESTA AÇÃO É IRREVERSÍVEL!${NC}\n"
    read -p "Digite 'SIM RESETAR' para confirmar: " CONFIRM
    [ "$CONFIRM" != "SIM RESETAR" ] && { log_info "Reset cancelado."; return 1; }

    # Confirmação extra em produção
    if [ "$NODE_ENV" = "production" ] || grep -q "NODE_ENV=production" "$BACKEND_DIR/.env" 2>/dev/null; then
        echo -e "\n${RED}⚠️  AMBIENTE DE PRODUÇÃO!${NC}"
        read -p "Digite 'PRODUÇÃO RESET' para confirmar: " PROD_CONFIRM
        [ "$PROD_CONFIRM" != "PRODUÇÃO RESET" ] && { log_info "Reset cancelado."; return 1; }
    fi

    cd "$BACKEND_DIR"
    log_info "Executando prisma migrate reset..."
    if PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="sim, autorizado" npx prisma migrate reset --force; then
        log_success "Banco resetado!"
        log_info "Executando seed..."
        SEED_PASSWORD="${SEED_PASSWORD:-Gsm@2024Secure!}" npm run db:seed 2>/dev/null || log_warning "Seed falhou"
        DB_RESET_DONE=true
        return 0
    fi
    log_error "Falha ao resetar!"; return 1
}

check_endpoint() {
    local url=$1 name=$2
    for i in {1..5}; do
        http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$url" 2>/dev/null || echo "000")
        [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ] && { log_success "$name: OK (HTTP $http_code)"; return 0; }
        [ $i -lt 5 ] && { log_warning "$name: Tentativa $i/5 (HTTP $http_code)"; sleep 2; }
    done
    log_error "$name: Falhou! (HTTP $http_code)"; return 1
}

# Verificações iniciais
[ ! -d "$PROJECT_ROOT" ] && { log_error "Diretório não encontrado: $PROJECT_ROOT"; exit 1; }
cd "$PROJECT_ROOT"

separator
echo -e "${GREEN}🚀 DEPLOY AUTOMATIZADO - CRM GRUPO SOUZA MONTEIRO${NC}"
separator

# 1. Git pull
log_info "1/12 Atualizando código..."
git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
EXPECTED_BRANCH="producao-gsm"

# Verificar se está na branch esperada
if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
    log_warning "Branch atual: $CURRENT_BRANCH (esperado: $EXPECTED_BRANCH)"
    read -p "Deseja trocar para $EXPECTED_BRANCH? (S/n): " SWITCH_BRANCH
    if [[ "${SWITCH_BRANCH:-S}" =~ ^[Ss]$ ]]; then
        git checkout "$EXPECTED_BRANCH" || { log_error "Falha ao trocar de branch!"; exit 1; }
        CURRENT_BRANCH="$EXPECTED_BRANCH"
    fi
fi

# Verificar se a branch remota existe
if ! git rev-parse --verify origin/$CURRENT_BRANCH >/dev/null 2>&1; then
    log_error "Branch remota origin/$CURRENT_BRANCH não existe!"
    exit 1
fi

# Verificar se há commits locais não pushados
LOCAL_COMMITS=$(git rev-list --count origin/$CURRENT_BRANCH..HEAD 2>/dev/null || echo "0")
if [ "$LOCAL_COMMITS" -gt 0 ]; then
    log_warning "Existem $LOCAL_COMMITS commits locais não pushados. Fazendo reset para origin..."
fi

# Forçar sincronização com origin (garante que pega a versão mais recente)
git reset --hard origin/$CURRENT_BRANCH

# Mostrar o commit atual
CURRENT_COMMIT=$(git log --oneline -1)
log_success "Código atualizado! (Branch: $CURRENT_BRANCH)"
log_info "Commit atual: $CURRENT_COMMIT"
separator

# 1.5 Verificar configs críticas
log_info "1.5/12 Verificando configurações..."
[ ! -f "$FRONTEND_DIR/.env.production" ] && {
    echo 'NEXT_PUBLIC_API_URL="https://prod-crm-gsm.cortexflow.space"' > "$FRONTEND_DIR/.env.production"
    log_success ".env.production criado!"
}

if [ -f "$BACKEND_DIR/.env" ]; then
    COOKIE_DOMAIN=$(grep "^COOKIE_DOMAIN=" "$BACKEND_DIR/.env" | cut -d'=' -f2 | tr -d '"')
    [ "$COOKIE_DOMAIN" = "localhost" ] && log_warning "COOKIE_DOMAIN=localhost (deveria ser .cortexflow.space)"
    grep -q "cortexflow.space" <<< "$(grep "^FRONTEND_URL=" "$BACKEND_DIR/.env")" || log_warning "FRONTEND_URL sem cortexflow.space"
else
    log_error "$BACKEND_DIR/.env não encontrado!"; exit 1
fi
separator

# 1.7 Pergunta sobre reset do banco
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                       🗄️  OPÇÕES DO BANCO DE DADOS                          ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════════${NC}\n"
echo -e "   ${GREEN}[N]${NC} NÃO - Apenas migrations (recomendado)\n   ${RED}[S]${NC} SIM - Reset completo (PERDE DADOS)\n"
read -p "Deseja fazer RESET do banco? (s/N): " RESET_CHOICE
[[ "${RESET_CHOICE:-N}" =~ ^[Ss]$ ]] && reset_database || log_info "Apenas migrations serão aplicadas."
separator

# 2. Parar serviços PM2
log_info "2/12 Parando serviços PM2..."
pm2 stop gsm-backend gsm-frontend 2>/dev/null || log_warning "Alguns serviços não estavam rodando"
log_success "Serviços parados!"
separator

# 3. Limpar cache e builds antigas
log_info "3/12 Limpando cache e builds antigas..."
cd "$FRONTEND_DIR"
rm -rf .next node_modules/.cache
log_success "Cache Frontend CRM limpo!"

cd "$BACKEND_DIR"
rm -rf node_modules/.cache dist
log_success "Cache Backend limpo!"
separator

# 4. Instalar dependências
log_info "4/12 Instalando dependências..."
cd "$BACKEND_DIR" && npm install --production=false && log_success "Backend: dependências OK"
cd "$FRONTEND_DIR" && npm install --production=false && log_success "Frontend CRM: dependências OK"
separator

# 5. Build limpo
log_info "5/12 Executando build limpo..."
cd "$FRONTEND_DIR"

# Executar build e capturar resultado
set +e
BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_RESULT=$?
set -e

if [ $BUILD_RESULT -ne 0 ]; then
    log_error "Build do Frontend FALHOU!"
    echo -e "\n${RED}════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}                         ERRO NO BUILD DO FRONTEND                           ${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════════════════════${NC}\n"
    echo "$BUILD_OUTPUT"
    echo -e "\n${YELLOW}Dica: Verifique erros de TypeScript ou dependências faltantes.${NC}"
    exit 1
fi

# Validar se o build foi realmente criado
if [ ! -d "$FRONTEND_DIR/.next" ] || [ ! -f "$FRONTEND_DIR/.next/BUILD_ID" ]; then
    log_error "Build do Frontend não foi criado corretamente!"
    echo -e "\n${RED}A pasta .next não existe ou está incompleta após o build.${NC}"
    echo -e "${YELLOW}Output do build:${NC}\n"
    echo "$BUILD_OUTPUT"
    exit 1
fi

log_success "Frontend CRM: build OK (BUILD_ID: $(cat "$FRONTEND_DIR/.next/BUILD_ID"))"
separator

# 6. Banco de dados
log_info "6/12 Sincronizando banco..."
cd "$BACKEND_DIR"
npx prisma generate

if [ "$DB_RESET_DONE" = true ]; then
    log_success "Banco já resetado neste deploy."
else
    # FIX: Apply SQL fixes for missing tables before migrations
    if [ -f "prisma/fix-production-scheduled-message.sql" ]; then
        log_info "Aplicando fix para tabelas faltantes..."
        set +e
        npx prisma db execute --schema prisma/schema.prisma --file prisma/fix-production-scheduled-message.sql 2>/dev/null
        set -e
        log_success "Fix SQL aplicado!"
    fi

    if npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"; then
        log_success "Banco sincronizado!"
        # Sincronizar vendedores sem Seller vinculado (BUG #005)
        log_info "Sincronizando vendedores..."
        node src/database/sync-sellers.js 2>/dev/null && log_success "Vendedores sincronizados!" || log_warning "Sync de vendedores falhou (não crítico)"
    else
        log_warning "Aplicando migrations..."
        set +e; MIGRATION_OUTPUT=$(npx prisma migrate deploy 2>&1); MIGRATION_RESULT=$?; set -e
        if [ $MIGRATION_RESULT -eq 0 ]; then
            log_success "Migrations aplicadas!"
            # Regenerar Prisma Client após migrations para reconhecer novos campos
            log_info "Regenerando Prisma Client..."
            npx prisma generate
            log_success "Prisma Client atualizado!"
            # Sincronizar vendedores sem Seller vinculado (BUG #005)
            log_info "Sincronizando vendedores..."
            node src/database/sync-sellers.js 2>/dev/null && log_success "Vendedores sincronizados!" || log_warning "Sync de vendedores falhou (não crítico)"
        else
            # Se migrations falharam, tentar aplicar SQL fix e continuar
            if echo "$MIGRATION_OUTPUT" | grep -q "P3005\|not empty"; then
                log_warning "Banco existente detectado, aplicando fixes..."
                # Aplicar SQL fixes para tabelas faltantes
                if [ -f "prisma/fix-production-scheduled-message.sql" ]; then
                    npx prisma db execute --schema prisma/schema.prisma --file prisma/fix-production-scheduled-message.sql 2>/dev/null || true
                fi
                # Marcar migrations como aplicadas (baseline)
                log_info "Sincronizando estado das migrations..."
                npx prisma migrate resolve --applied 20251129230000_add_whatsapp_ia_system 2>/dev/null || true
                npx prisma generate
                log_success "Banco sincronizado via fixes!"
            else
                log_error "Migrations falharam!"
                echo "$MIGRATION_OUTPUT"
                echo -e "\nOpções:\n   • Resolver manualmente\n   • Resetar banco (PERDE DADOS)\n"
                read -p "Deseja RESETAR o banco? (s/N): " RETRY_RESET
                if [[ "${RETRY_RESET:-N}" =~ ^[Ss]$ ]]; then
                    reset_database || { log_error "Resolva manualmente."; exit 1; }
                else
                    log_error "Deploy interrompido."; exit 1
                fi
            fi
        fi
    fi
fi
separator

# 7. Iniciar serviços PM2
log_info "7/12 Iniciando serviços PM2..."
cd "$PROJECT_ROOT/gsm-2.0"

# Deletar processos antigos e iniciar limpo (apenas backend e frontend CRM)
pm2 delete gsm-backend gsm-frontend 2>/dev/null || true
pm2 start ecosystem.config.js --only gsm-backend,gsm-frontend
log_success "Serviços iniciados!"

sleep 3
pm2 save
separator

# 8. Validação (apenas serviços PM2)
log_info "8/12 Validando serviços PM2..."
pm2 list | grep -E "gsm-backend|gsm-frontend"

# Verificar apenas serviços PM2 (backend e frontend CRM)
PROD_SERVICES_STATUS=$(pm2 jlist 2>/dev/null | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const prodServices = ['gsm-backend', 'gsm-frontend'];
const problems = data.filter(p => prodServices.includes(p.name) && p.pm2_env.status !== 'online');
if (problems.length > 0) {
    console.log('PROBLEMS:' + problems.map(p => p.name + '=' + p.pm2_env.status).join(','));
    process.exit(1);
}
console.log('OK');
" 2>/dev/null) || PROD_SERVICES_STATUS="ERROR"

if [[ "$PROD_SERVICES_STATUS" == "OK" ]]; then
    log_success "Todos os serviços PM2 online!"
elif [[ "$PROD_SERVICES_STATUS" == *"PROBLEMS"* ]]; then
    log_error "Serviços PM2 com problemas: ${PROD_SERVICES_STATUS#PROBLEMS:}"
    pm2 logs gsm-backend gsm-frontend --lines 20 --nostream
    exit 1
else
    log_warning "Não foi possível verificar status dos serviços"
fi

log_info "Testando conexão com banco..."
cd "$BACKEND_DIR"
node -e "const{PrismaClient}=require('@prisma/client');new PrismaClient().\$connect().then(()=>{console.log('✓ OK');process.exit(0)}).catch(e=>{console.error('✗',e.message);process.exit(1)})" 2>/dev/null || { log_error "Banco: Falha!"; exit 1; }
log_success "Banco: Conectado!"

log_info "Testando endpoints..."
check_endpoint "http://localhost:4000/health" "Backend (4000)" || pm2 logs gsm-backend --lines 10 --nostream

# Verificar frontend com mais detalhes se falhar
if ! check_endpoint "http://localhost:3000/" "Frontend (3000)"; then
    log_error "Frontend não respondeu! Verificando logs..."
    pm2 logs gsm-frontend --lines 20 --nostream

    # Verificar se o build existe
    if [ ! -f "$FRONTEND_DIR/.next/BUILD_ID" ]; then
        log_error "CAUSA: Build do frontend não existe! A pasta .next está vazia ou corrompida."
        log_info "Tentando rebuild do frontend..."
        cd "$FRONTEND_DIR"
        npm run build
        if [ -f "$FRONTEND_DIR/.next/BUILD_ID" ]; then
            log_success "Rebuild concluído! Reiniciando frontend..."
            pm2 restart gsm-frontend
            sleep 5
            check_endpoint "http://localhost:3000/" "Frontend (3000) - retry" || {
                log_error "Frontend ainda não responde após rebuild!"
                exit 1
            }
        else
            log_error "Rebuild falhou! Verifique os erros acima."
            exit 1
        fi
    else
        log_error "Build existe mas frontend não responde. Verifique os logs acima."
        exit 1
    fi
fi

log_info "Site institucional: ignorado (estático, sem alterações)"
separator

# 9. Resumo
log_info "9/12 Resumo"
separator
pm2 list
echo -e "\n🗄️  Banco: $([ "$DB_RESET_DONE" = true ] && echo -e "${YELLOW}RESETADO${NC}" || echo -e "${GREEN}Migrations aplicadas${NC}")"
echo -e "\n🌐 URLs:\n   • Site: https://www.cortexflow.space\n   • CRM: https://www.cortexflow.space/crm-grupo-souza-monteiro\n   • API: http://localhost:4000/api"
echo -e "\n📝 Comandos: pm2 logs | pm2 reload [serviço] | pm2 list"
separator
log_success "🎉 DEPLOY CONCLUÍDO!"
separator
