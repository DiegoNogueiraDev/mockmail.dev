#!/bin/bash
# =============================================================================
# DEPLOY PM2 - MockMail.dev
# =============================================================================
# Deploy de API e Frontend via PM2
# Infraestrutura (MongoDB, Redis) via Docker (./deploy-docker.sh)
#
# Uso:
#   ./deploy.sh                        # Deploy homologação
#   ./deploy.sh --env=producao         # Deploy produção
#   ./deploy.sh --skip-deps            # Pular npm install
#   ./deploy.sh --skip-build           # Pular build
#
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Detectar diretório do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Diretórios (RENOMEADOS)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
EMAIL_PROCESSOR_DIR="$PROJECT_ROOT/email-processor"
BACKUP_DIR="$PROJECT_ROOT/.deploy-backups"

# Configurações padrão
ENVIRONMENT="homologacao"
BRANCH=""
SKIP_DEPS=false
SKIP_BUILD=false
DRY_RUN=false

# URLs por ambiente
declare -A FRONTEND_URLS=(
    ["homologacao"]="https://homologacao.mockmail.dev"
    ["producao"]="https://mockmail.dev"
)

declare -A API_URLS=(
    ["homologacao"]="https://api.homologacao.mockmail.dev"
    ["producao"]="https://api.mockmail.dev"
)

declare -A BRANCHES=(
    ["homologacao"]="homologacao-mockmail"
    ["producao"]="producao-mockmail"
)

# Portas por ambiente
declare -A API_PORTS=(
    ["homologacao"]="3010"
    ["producao"]="3000"
)

declare -A FRONTEND_PORTS=(
    ["homologacao"]="3011"
    ["producao"]="3001"
)

# Funções de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

separator() {
    echo -e "\n${CYAN}════════════════════════════════════════════════════════════════════════════${NC}\n"
}

# Parse argumentos
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env=*)
                ENVIRONMENT="${1#*=}"
                shift
                ;;
            --branch=*)
                BRANCH="${1#*=}"
                shift
                ;;
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Opção desconhecida: $1"
                exit 1
                ;;
        esac
    done

    # Usar branch do ambiente se não especificada
    if [ -z "$BRANCH" ]; then
        BRANCH="${BRANCHES[$ENVIRONMENT]}"
    fi
}

show_help() {
    echo "MockMail.dev - Deploy PM2"
    echo ""
    echo "Deploy de API e Frontend via PM2."
    echo "Infraestrutura via Docker (./deploy-docker.sh)"
    echo ""
    echo "Uso: ./deploy.sh [opções]"
    echo ""
    echo "Opções:"
    echo "  --env=ENV        Ambiente: homologacao (default) ou producao"
    echo "  --branch=BRANCH  Branch específica para deploy"
    echo "  --skip-deps      Pular instalação de dependências"
    echo "  --skip-build     Pular build"
    echo "  --dry-run        Simular sem aplicar mudanças"
    echo "  --help           Exibir esta ajuda"
    echo ""
    echo "Fluxo completo:"
    echo "  1. ./deploy-docker.sh --env=homologacao   # Subir infra"
    echo "  2. ./deploy.sh --env=homologacao          # Subir API/Frontend"
}

# Verificar pré-requisitos
check_prerequisites() {
    log_step "Verificando pré-requisitos"

    # Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js não encontrado!"
        exit 1
    fi
    log_success "Node.js $(node --version)"

    # npm
    if ! command -v npm &> /dev/null; then
        log_error "npm não encontrado!"
        exit 1
    fi
    log_success "npm $(npm --version)"

    # PM2
    if ! command -v pm2 &> /dev/null; then
        log_warning "PM2 não encontrado. Instalando..."
        npm install -g pm2
    fi
    log_success "PM2 $(pm2 --version)"

    # Git
    if ! command -v git &> /dev/null; then
        log_error "Git não encontrado!"
        exit 1
    fi
    log_success "Git $(git --version | cut -d' ' -f3)"

    # Diretórios do projeto
    [ ! -d "$BACKEND_DIR" ] && { log_error "Diretório backend não encontrado: $BACKEND_DIR"; exit 1; }
    [ ! -d "$FRONTEND_DIR" ] && { log_error "Diretório frontend não encontrado: $FRONTEND_DIR"; exit 1; }
    log_success "Estrutura do projeto OK"
}

# Configurar arquivos .env
setup_env_files() {
    log_step "Configurando arquivos .env"

    local backend_env_template="$PROJECT_ROOT/backend/.env.$ENVIRONMENT"
    local backend_env_target="$BACKEND_DIR/.env"
    local frontend_env_template="$PROJECT_ROOT/frontend/.env.$ENVIRONMENT"
    local frontend_env_target="$FRONTEND_DIR/.env"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Configurando .env files..."
        return 0
    fi

    # Backend .env
    if [ -f "$backend_env_template" ]; then
        cp "$backend_env_template" "$backend_env_target"
        log_success "Backend .env copiado de .env.$ENVIRONMENT"
    else
        if [ -f "$backend_env_target" ]; then
            log_warning "Template backend/.env.$ENVIRONMENT não encontrado, usando .env existente"
        else
            log_error "Backend .env não encontrado!"
            log_info "Crie o arquivo: backend/.env.$ENVIRONMENT"
            exit 1
        fi
    fi

    # Frontend .env
    if [ -f "$frontend_env_template" ]; then
        cp "$frontend_env_template" "$frontend_env_target"
        log_success "Frontend .env copiado de .env.$ENVIRONMENT"
    else
        if [ -f "$frontend_env_target" ]; then
            log_warning "Template frontend/.env.$ENVIRONMENT não encontrado, usando .env existente"
        else
            log_warning "Frontend .env não encontrado (pode não ser necessário)"
        fi
    fi
}

# Verificar infraestrutura Docker
check_docker_infra() {
    log_step "Verificando infraestrutura Docker"

    local mongo_ok=false
    local redis_ok=false


    # Verificar MongoDB
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "mockmail.*mongodb"; then
        mongo_ok=true
        log_success "MongoDB: Rodando"
    else
        log_warning "MongoDB: Não encontrado"
    fi

    # Verificar Redis
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "mockmail.*redis"; then
        redis_ok=true
        log_success "Redis: Rodando"
    else
        log_warning "Redis: Não encontrado"
    fi

    # Se algum serviço não estiver rodando, avisar
    if [ "$mongo_ok" = false ] || [ "$redis_ok" = false ]; then
        echo ""
        log_warning "Infraestrutura Docker não está completa!"
        log_info "Execute primeiro: ./deploy-docker.sh --env=$ENVIRONMENT"
        echo ""
        read -p "Continuar mesmo assim? (s/N): " CONTINUE
        if [[ ! "${CONTINUE:-N}" =~ ^[Ss]$ ]]; then
            log_info "Deploy cancelado. Execute ./deploy-docker.sh primeiro."
            exit 0
        fi
    fi
}

# Criar backup
create_backup() {
    log_step "Criando backup"

    mkdir -p "$BACKUP_DIR"

    BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

    cd "$PROJECT_ROOT"
    CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    echo "$CURRENT_COMMIT" > "$BACKUP_PATH.commit"
    echo "$ENVIRONMENT" > "$BACKUP_PATH.env"

    # Salvar estado PM2
    pm2 jlist > "$BACKUP_PATH.pm2.json" 2>/dev/null || true

    log_success "Backup criado: $BACKUP_NAME"
    log_info "Commit atual: ${CURRENT_COMMIT:0:8}"

    # Limpar backups antigos (manter últimos 5)
    cd "$BACKUP_DIR"
    ls -t *.commit 2>/dev/null | tail -n +6 | while read f; do
        rm -f "${f%.commit}"* 2>/dev/null
    done
}

# Atualizar código
update_code() {
    log_step "Atualizando código"

    cd "$PROJECT_ROOT"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Simulando git pull..."
        return 0
    fi

    log_info "Buscando atualizações..."
    git fetch origin

    # Verificar se branch existe
    if ! git rev-parse --verify "origin/$BRANCH" &>/dev/null; then
        log_error "Branch não encontrada: $BRANCH"
        exit 1
    fi

    log_info "Mudando para branch: $BRANCH"
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"

    log_info "Aplicando atualizações..."
    git pull origin "$BRANCH"

    log_success "Código atualizado: $(git log --oneline -1)"
}

# Instalar dependências do Backend
install_backend_deps() {
    log_step "Instalando dependências do Backend"

    cd "$BACKEND_DIR"

    if [ "$SKIP_DEPS" = true ]; then
        log_info "Pulando instalação (--skip-deps)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] npm ci"
        return 0
    fi

    # Limpar node_modules para build limpo
    log_info "Limpando node_modules..."
    rm -rf node_modules package-lock.json

    log_info "Instalando dependências..."
    npm install

    log_success "Dependências do backend instaladas"
}

# Build do Backend
build_backend() {
    log_step "Compilando Backend"

    cd "$BACKEND_DIR"

    if [ "$SKIP_BUILD" = true ]; then
        log_info "Pulando build (--skip-build)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] npm run build"
        return 0
    fi

    # Limpar build anterior
    log_info "Limpando build anterior..."
    rm -rf dist/

    log_info "Compilando TypeScript..."
    if ! npm run build; then
        log_error "Falha na compilação do Backend!"
        return 1
    fi

    # Verificar se dist foi criado
    if [ ! -d "dist" ] || [ ! -f "dist/server.js" ]; then
        log_error "Build do backend falhou: dist/server.js não encontrado!"
        return 1
    fi

    log_success "Backend compilado (dist/server.js criado)"
}

# Instalar dependências do Frontend
install_frontend_deps() {
    log_step "Instalando dependências do Frontend"

    cd "$FRONTEND_DIR"

    if [ "$SKIP_DEPS" = true ]; then
        log_info "Pulando instalação (--skip-deps)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] npm ci"
        return 0
    fi

    # Limpar node_modules para build limpo
    log_info "Limpando node_modules..."
    rm -rf node_modules package-lock.json

    log_info "Instalando dependências..."
    npm install

    log_success "Dependências do frontend instaladas"
}

# Build do Frontend
build_frontend() {
    log_step "Compilando Frontend"

    cd "$FRONTEND_DIR"

    if [ "$SKIP_BUILD" = true ]; then
        log_info "Pulando build (--skip-build)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] npm run build"
        return 0
    fi

    # Limpar build anterior
    log_info "Limpando build anterior..."
    rm -rf .next/

    # Definir variáveis de ambiente para build
    export NEXT_PUBLIC_API_URL="${API_URLS[$ENVIRONMENT]}"

    log_info "Compilando Next.js (API_URL: $NEXT_PUBLIC_API_URL)..."
    if ! npm run build; then
        log_error "Falha na compilação do Frontend!"
        return 1
    fi

    # Verificar se .next foi criado corretamente
    if [ ! -d ".next" ] || [ ! -d ".next/server" ]; then
        log_error "Build do frontend falhou: .next/server não encontrado!"
        return 1
    fi

    log_success "Frontend compilado (.next criado)"
}

# =============================================================================
# FUNÇÕES DE CONFIGURAÇÃO DO SERVIDOR
# =============================================================================

# Setup do Email Processor (TypeScript - agora via PM2)
setup_email_processor() {
    log_step "Configurando Email Processor (TypeScript)"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Configurando email processor..."
        return 0
    fi

    # Criar diretório de logs se não existir
    if [ ! -d "/var/log/mockmail" ]; then
        sudo mkdir -p /var/log/mockmail
        sudo chmod 755 /var/log/mockmail
        log_info "Diretório /var/log/mockmail criado"
    fi

    # Criar FIFO se não existir (usado pelo Postfix)
    if [ ! -p /var/spool/email-processor ]; then
        sudo mkfifo /var/spool/email-processor 2>/dev/null || true
        sudo chmod 666 /var/spool/email-processor 2>/dev/null || true
        log_info "FIFO criado em /var/spool/email-processor"
    fi

    # Copiar email-handler.sh (ainda necessário para Postfix)
    if [ -f "$EMAIL_PROCESSOR_DIR/email-handler.sh" ]; then
        sudo cp "$EMAIL_PROCESSOR_DIR/email-handler.sh" /usr/local/bin/
        sudo chmod +x /usr/local/bin/email-handler.sh
        log_success "email-handler.sh instalado"
    fi

    # Verificar se o build do processor existe
    if [ ! -f "$BACKEND_DIR/dist/emailProcessor.js" ]; then
        log_error "dist/emailProcessor.js não encontrado! Verifique o build."
        return 1
    fi

    log_success "Email Processor TypeScript configurado (será iniciado via PM2)"
}

# Sincronizar configurações do servidor (Postfix, HAProxy, Systemd)
sync_server_configs() {
    log_step "Sincronizando configurações do servidor"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Sincronizando configs..."
        return 0
    fi

    local CONFIG_DIR="$PROJECT_ROOT/server-config"
    local CHANGES_MADE=false

    # Postfix configs
    if [ -d "$CONFIG_DIR/postfix" ]; then
        if [ -f "$CONFIG_DIR/postfix/main.cf" ]; then
            if ! sudo diff -q "$CONFIG_DIR/postfix/main.cf" /etc/postfix/main.cf &>/dev/null; then
                sudo cp "$CONFIG_DIR/postfix/main.cf" /etc/postfix/main.cf
                log_success "Postfix main.cf atualizado"
                CHANGES_MADE=true
            else
                log_info "Postfix main.cf: sem alterações"
            fi
        fi

        if [ -f "$CONFIG_DIR/postfix/master.cf" ]; then
            if ! sudo diff -q "$CONFIG_DIR/postfix/master.cf" /etc/postfix/master.cf &>/dev/null; then
                sudo cp "$CONFIG_DIR/postfix/master.cf" /etc/postfix/master.cf
                log_success "Postfix master.cf atualizado"
                CHANGES_MADE=true
            fi
        fi

        # Validar e recarregar Postfix se houve mudanças
        if [ "$CHANGES_MADE" = true ]; then
            log_info "Validando configuração do Postfix..."
            if sudo postfix check 2>/dev/null; then
                sudo systemctl reload postfix 2>/dev/null && log_success "Postfix validado e recarregado" || log_warning "Falha ao recarregar Postfix"
            else
                log_error "Configuração do Postfix inválida! Verifique os arquivos."
            fi
        fi
    fi

    # HAProxy config
    CHANGES_MADE=false
    if [ -f "$CONFIG_DIR/haproxy/haproxy.cfg" ]; then
        if ! sudo diff -q "$CONFIG_DIR/haproxy/haproxy.cfg" /etc/haproxy/haproxy.cfg &>/dev/null; then
            # Validar config antes de aplicar
            if sudo haproxy -c -f "$CONFIG_DIR/haproxy/haproxy.cfg" &>/dev/null; then
                sudo cp "$CONFIG_DIR/haproxy/haproxy.cfg" /etc/haproxy/haproxy.cfg
                CHANGES_MADE=true
            else
                log_error "HAProxy config inválida! Não aplicando..."
            fi
        else
            log_info "HAProxy: sem alterações"
        fi
    fi

    # Corrigir health check do frontend para aceitar redirects (301, 302, 307)
    # Next.js retorna redirect em algumas rotas, o HAProxy precisa aceitar
    if sudo grep -q "backend_frontend" /etc/haproxy/haproxy.cfg 2>/dev/null; then
        if sudo grep -q "http-check expect status 200$" /etc/haproxy/haproxy.cfg 2>/dev/null; then
            sudo sed -i 's/http-check expect status 200$/http-check expect status 200,301,302,307/' /etc/haproxy/haproxy.cfg
            log_success "HAProxy: health check do frontend corrigido para aceitar redirects"
            CHANGES_MADE=true
        fi
    fi

    # Recarregar HAProxy se houve mudanças
    if [ "$CHANGES_MADE" = true ]; then
        if sudo haproxy -c -f /etc/haproxy/haproxy.cfg &>/dev/null; then
            sudo systemctl reload haproxy 2>/dev/null && log_success "HAProxy recarregado" || log_warning "Falha ao recarregar HAProxy"
        else
            log_error "HAProxy config inválida após correções!"
        fi
    fi

    # Systemd services
    if [ -d "$CONFIG_DIR/systemd" ]; then
        for service_file in "$CONFIG_DIR/systemd"/*.service; do
            if [ -f "$service_file" ]; then
                local service_name=$(basename "$service_file")
                if ! sudo diff -q "$service_file" "/etc/systemd/system/$service_name" &>/dev/null 2>&1; then
                    sudo cp "$service_file" "/etc/systemd/system/$service_name"
                    log_success "Systemd $service_name atualizado"
                    CHANGES_MADE=true
                fi
            fi
        done

        if [ "$CHANGES_MADE" = true ]; then
            sudo systemctl daemon-reload
            log_success "Systemd daemon recarregado"
        fi
    fi
}

# Validar conexões de banco antes do deploy
validate_database_connections() {
    log_step "Validando conexões de banco de dados"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Validando conexões..."
        return 0
    fi

    local ALL_OK=true

    # Nomes dos containers por ambiente
    # Homologação: mockmail-mongodb-hml, mockmail-redis-hml
    # Produção: mockmail-mongodb, mockmail-redis
    local mongo_container="mockmail-mongodb"
    local redis_container="mockmail-redis"
    [ "$ENVIRONMENT" = "homologacao" ] && mongo_container="mockmail-mongodb-hml"
    [ "$ENVIRONMENT" = "homologacao" ] && redis_container="mockmail-redis-hml"

    # Testar MongoDB
    log_info "Testando MongoDB..."
    if docker exec "$mongo_container" mongosh --quiet --eval "db.runCommand({ping:1})" &>/dev/null 2>&1; then
        log_success "MongoDB: Conexão OK"
    else
        log_error "MongoDB: Falha na conexão!"
        ALL_OK=false
    fi

    # Testar Redis
    log_info "Testando Redis..."
    if docker exec "$redis_container" redis-cli ping &>/dev/null 2>&1; then
        log_success "Redis: Conexão OK"
    else
        log_error "Redis: Falha na conexão!"
        ALL_OK=false
    fi

    if [ "$ALL_OK" = false ]; then
        log_error "Falha na validação de bancos! Verifique se a infraestrutura Docker está rodando."
        read -p "Continuar mesmo assim? (s/N): " CONTINUE
        if [[ ! "${CONTINUE:-N}" =~ ^[Ss]$ ]]; then
            log_info "Deploy cancelado."
            exit 1
        fi
    fi
}

# Prisma migrations - DESATIVADO (PostgreSQL removido)
# O sistema agora usa exclusivamente MongoDB via Mongoose
run_prisma_migrations() {
    log_info "Prisma migrations desativadas (MongoDB only)"
}

# Função de rollback automático
rollback_deploy() {
    log_step "Executando Rollback"

    if [ -z "$BACKUP_PATH" ]; then
        log_error "Backup não encontrado! Rollback manual necessário."
        return 1
    fi

    local commit_file="${BACKUP_PATH}.commit"
    if [ ! -f "$commit_file" ]; then
        log_error "Arquivo de commit do backup não encontrado!"
        return 1
    fi

    local previous_commit=$(cat "$commit_file")
    
    log_warning "Revertendo para commit: $previous_commit"

    cd "$PROJECT_ROOT"
    
    # Reverter código
    git checkout "$previous_commit" -- .
    
    # Reconstruir backend
    cd "$BACKEND_DIR"
    npm run build
    
    # Reconstruir frontend
    cd "$FRONTEND_DIR"
    npm run build
    
    # Reiniciar serviços
    cd "$PROJECT_ROOT"
    pm2 restart ecosystem.config.js
    
    log_success "Rollback concluído para commit $previous_commit"
}

# Wrapper para deploy com rollback automático em caso de falha
deploy_with_rollback() {
    local step_name="$1"
    local step_function="$2"

    if ! $step_function; then
        log_error "Falha em: $step_name"
        read -p "Deseja executar rollback automático? (S/n): " DO_ROLLBACK
        if [[ "${DO_ROLLBACK:-S}" =~ ^[Ss]$ ]]; then
            rollback_deploy
        fi
        exit 1
    fi
}

# Health check avançado com testes de conectividade
enhanced_health_check() {
    log_step "Verificação de saúde avançada"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Health check..."
        return 0
    fi

    sleep 5

    local api_port="${API_PORTS[$ENVIRONMENT]}"
    local frontend_port="${FRONTEND_PORTS[$ENVIRONMENT]}"
    local ALL_OK=true
    local WARNINGS=0

    # 1. Verificar PM2
    log_info "Verificando PM2..."
    local env_suffix=""
    [ "$ENVIRONMENT" = "homologacao" ] && env_suffix="-hml"
    
    local api_status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"mockmail-api${env_suffix}\") | .pm2_env.status" 2>/dev/null || echo "unknown")
    local frontend_status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"mockmail-frontend${env_suffix}\") | .pm2_env.status" 2>/dev/null || echo "unknown")

    if [ "$api_status" = "online" ]; then
        log_success "PM2 API: online"
    else
        log_error "PM2 API: $api_status"
        ALL_OK=false
    fi

    if [ "$frontend_status" = "online" ]; then
        log_success "PM2 Frontend: online"
    else
        log_error "PM2 Frontend: $frontend_status"
        ALL_OK=false
    fi

    # 2. Verificar API HTTP
    log_info "Verificando endpoints..."
    if curl -s -f "http://localhost:$api_port/api/health" > /dev/null 2>&1; then
        log_success "API Health: OK (localhost:$api_port)"
    elif curl -s -f "http://localhost:$api_port/api/csrf-token" > /dev/null 2>&1; then
        log_success "API CSRF: OK (localhost:$api_port)"
    else
        log_error "API: Não responde (localhost:$api_port)"
        ALL_OK=false
    fi

    # 3. Verificar Frontend
    if curl -s -f "http://localhost:$frontend_port" > /dev/null 2>&1; then
        log_success "Frontend: OK (localhost:$frontend_port)"
    else
        log_warning "Frontend: Não responde (pode estar iniciando...)"
        ((WARNINGS++))
    fi

    # 4. Verificar MongoDB (via Docker)
    log_info "Verificando databases..."
    if docker exec mockmail-mongodb mongosh --quiet --eval "db.runCommand({ping:1})" &>/dev/null 2>&1 || \
       docker exec mockmail-mongodb-hml mongosh --quiet --eval "db.runCommand({ping:1})" &>/dev/null 2>&1; then
        log_success "MongoDB: Conectado"
    else
        log_warning "MongoDB: Não foi possível verificar conexão"
        ((WARNINGS++))
    fi

    # 5. Verificar Redis (via Docker)
    if docker exec mockmail-redis redis-cli ping &>/dev/null 2>&1 || \
       docker exec mockmail-redis-hml redis-cli ping &>/dev/null 2>&1; then
        log_success "Redis: Conectado"
    else
        log_warning "Redis: Não foi possível verificar conexão"
        ((WARNINGS++))
    fi

    # 6. Verificar Email Processor (agora via PM2)
    local processor_status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"mockmail-processor${env_suffix}\") | .pm2_env.status" 2>/dev/null || echo "unknown")
    if [ "$processor_status" = "online" ]; then
        log_success "Email Processor (PM2): online"
    else
        log_warning "Email Processor (PM2): $processor_status"
        ((WARNINGS++))
    fi

    # 7. Verificar Postfix
    if sudo systemctl is-active --quiet postfix 2>/dev/null; then
        log_success "Postfix: Ativo"
    else
        log_warning "Postfix: Não está ativo"
        ((WARNINGS++))
    fi

    # Resumo
    echo ""
    if [ "$ALL_OK" = false ]; then
        log_error "Alguns serviços críticos falharam! Verifique: pm2 logs"
        return 1
    elif [ "$WARNINGS" -gt 0 ]; then
        log_warning "Deploy OK, mas $WARNINGS aviso(s). Verifique os serviços acima."
        return 0
    else
        log_success "Todos os serviços estão saudáveis!"
        return 0
    fi
}

# Criar/Atualizar ecosystem.config.js
setup_ecosystem() {
    log_step "Configurando PM2 Ecosystem"

    cd "$PROJECT_ROOT"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Criando ecosystem.config.js..."
        return 0
    fi

    local api_port="${API_PORTS[$ENVIRONMENT]}"
    local frontend_port="${FRONTEND_PORTS[$ENVIRONMENT]}"
    local env_suffix=""

    if [ "$ENVIRONMENT" = "homologacao" ]; then
        env_suffix="-hml"
    fi

    # Detectar caminho do Node.js
    local node_path=$(which node)

    # Verificar se o processor único já está rodando
    # O processor é único e atende todos os ambientes
    local processor_running=false
    if pm2 jlist 2>/dev/null | jq -e '.[] | select(.name=="mockmail-processor")' &>/dev/null; then
        processor_running=true
        log_info "Email Processor já está rodando (único para todos os ambientes)"
    fi

    # Criar ecosystem.config.js SEM o processor se ele já estiver rodando
    if [ "$processor_running" = true ]; then
        cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'mockmail-api${env_suffix}',
      cwd: './backend',
      script: 'dist/server.js',
      interpreter: '${node_path}',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: ${api_port},
        INTERNAL_API_TOKEN: 'mockmail-internal-2026'
      }
    },
    {
      name: 'mockmail-frontend${env_suffix}',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p ${frontend_port}',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: ${frontend_port}
      }
    }
  ]
};
EOF
        log_success "ecosystem.config.js criado (API=$api_port, Frontend=$frontend_port) - Processor já ativo"
    else
        # Incluir processor único (sem sufixo de ambiente)
        cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'mockmail-api${env_suffix}',
      cwd: './backend',
      script: 'dist/server.js',
      interpreter: '${node_path}',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: ${api_port},
        INTERNAL_API_TOKEN: 'mockmail-internal-2026'
      }
    },
    {
      name: 'mockmail-frontend${env_suffix}',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p ${frontend_port}',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: ${frontend_port}
      }
    },
    {
      name: 'mockmail-processor',
      cwd: './backend',
      script: 'dist/emailProcessor.js',
      interpreter: '${node_path}',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        MOCKMAIL_FIFO_PATH: '/var/spool/email-processor',
        MOCKMAIL_DEBUG: 'true',
        INTERNAL_API_TOKEN: 'mockmail-internal-2026',
        HML_API_PORT: '3010',
        PROD_API_PORT: '3000',
        HML_ENABLED: 'true',
        PROD_ENABLED: 'true'
      }
    }
  ]
};
EOF
        log_success "ecosystem.config.js criado (API=$api_port, Frontend=$frontend_port, Processor=ÚNICO)"
    fi
}

# Reiniciar serviços PM2
restart_services() {
    log_step "Reiniciando serviços PM2"

    cd "$PROJECT_ROOT"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] pm2 reload ecosystem.config.js"
        return 0
    fi

    local env_suffix=""
    if [ "$ENVIRONMENT" = "homologacao" ]; then
        env_suffix="-hml"
    fi

    # Parar serviços antigos do ambiente atual (API e Frontend)
    pm2 delete "mockmail-api${env_suffix}" 2>/dev/null || true
    pm2 delete "mockmail-frontend${env_suffix}" 2>/dev/null || true

    # O processor é ÚNICO - só deleta se não houver outros ambientes ativos
    # Verifica se existem outras APIs rodando antes de parar o processor
    local other_apis=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | startswith("mockmail-api")) | .name' 2>/dev/null | grep -v "mockmail-api${env_suffix}" | wc -l)

    if [ "$other_apis" -eq 0 ]; then
        # Nenhuma outra API rodando, pode reiniciar o processor
        pm2 delete "mockmail-processor" 2>/dev/null || true
        log_info "Processor será reiniciado (nenhuma outra API ativa)"
    else
        log_info "Processor mantido ativo (outras APIs dependem dele)"
    fi

    # Iniciar serviços
    log_info "Iniciando serviços..."
    pm2 start ecosystem.config.js

    # Salvar configuração PM2
    pm2 save

    log_success "Serviços PM2 iniciados"
}

# Parar processadores Python (systemd) - agora usamos TypeScript via PM2
stop_python_processors() {
    log_step "Parando processadores Python (migração para TypeScript)"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Parando processadores Python..."
        return 0
    fi

    # Parar e desabilitar processadores Python se estiverem rodando
    local services=("email-processor" "mockmail-email-processor")
    
    for service in "${services[@]}"; do
        if sudo systemctl is-active --quiet "$service" 2>/dev/null; then
            log_info "Parando $service.service..."
            sudo systemctl stop "$service" 2>/dev/null || true
            sudo systemctl disable "$service" 2>/dev/null || true
            log_success "$service.service parado e desabilitado"
        fi
    done

    log_info "Processador de emails agora roda via PM2 (TypeScript)"
}

# Exibir resumo
show_summary() {
    separator
    echo -e "${GREEN}🚀 DEPLOY PM2 CONCLUÍDO - MockMail.dev${NC}"
    separator

    local api_port="${API_PORTS[$ENVIRONMENT]}"
    local frontend_port="${FRONTEND_PORTS[$ENVIRONMENT]}"

    echo -e "📊 Ambiente: ${CYAN}$ENVIRONMENT${NC}"
    echo -e "📌 Branch: ${CYAN}$BRANCH${NC}"
    echo ""
    echo -e "🌐 URLs:"
    echo -e "   Frontend: ${GREEN}${FRONTEND_URLS[$ENVIRONMENT]}${NC}"
    echo -e "   API:      ${GREEN}${API_URLS[$ENVIRONMENT]}${NC}"
    echo ""
    echo -e "🔌 Portas locais:"
    echo -e "   API:      ${BLUE}localhost:$api_port${NC}"
    echo -e "   Frontend: ${BLUE}localhost:$frontend_port${NC}"
    echo ""
    echo -e "📝 Commit:"
    cd "$PROJECT_ROOT"
    git log --oneline -1
    echo ""
    echo -e "📦 Status PM2:"
    pm2 list | grep mockmail || true
    echo ""
    echo -e "🔧 Comandos úteis:"
    echo -e "   pm2 logs               # Ver logs"
    echo -e "   pm2 monit              # Monitoramento"
    echo -e "   pm2 restart all        # Reiniciar"

    separator
}

# =============================================================================
# MAIN
# =============================================================================

parse_args "$@"

separator
echo -e "${GREEN}████████████████████████████████████████████████████████████████${NC}"
echo -e "${GREEN}█                                                              █${NC}"
echo -e "${GREEN}█   ${CYAN}MockMail.dev - Deploy PM2${GREEN}                                 █${NC}"
echo -e "${GREEN}█                                                              █${NC}"
echo -e "${GREEN}████████████████████████████████████████████████████████████████${NC}"
echo ""
echo -e "   Ambiente: ${MAGENTA}$ENVIRONMENT${NC}"
echo -e "   Branch:   ${MAGENTA}$BRANCH${NC}"
echo -e "   Frontend: ${BLUE}${FRONTEND_URLS[$ENVIRONMENT]}${NC}"
echo -e "   API:      ${BLUE}${API_URLS[$ENVIRONMENT]}${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "   ${YELLOW}MODO: DRY RUN (simulação)${NC}"
fi
separator

# Confirmação
if [ "$DRY_RUN" = false ]; then
    read -p "Continuar com o deploy? (S/n): " CONFIRM
    if [[ "${CONFIRM:-S}" =~ ^[Nn]$ ]]; then
        log_info "Deploy cancelado."
        exit 0
    fi
fi

# Executar etapas
check_prerequisites
check_docker_infra
validate_database_connections
create_backup
update_code
setup_env_files
install_backend_deps
build_backend || { log_error "Build do backend falhou!"; exit 1; }
run_prisma_migrations
install_frontend_deps
build_frontend || { log_error "Build do frontend falhou!"; exit 1; }
setup_email_processor
sync_server_configs
setup_ecosystem
restart_services
stop_python_processors

# Aguardar estabilização
log_info "Aguardando estabilização dos serviços..."
sleep 5

# Health check final
if ! enhanced_health_check; then
    log_error "Health check falhou!"
    read -p "Deseja executar rollback automático? (s/N): " DO_ROLLBACK
    if [[ "${DO_ROLLBACK:-N}" =~ ^[Ss]$ ]]; then
        rollback_deploy
        exit 1
    fi
fi

show_summary

log_success "🎉 Deploy concluído com sucesso!"
