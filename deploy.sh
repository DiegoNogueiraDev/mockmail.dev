#!/bin/bash
# =============================================================================
# DEPLOY COMPLETO - MockMail.dev
# =============================================================================
# Deploy completo com instalação de dependências e rebuild
#
# Ambientes:
#   - Homologação: https://homologacao.mockmail.dev (frontend)
#                  https://api.homologacao.mockmail.dev (API)
#   - Produção:    https://mockmail.dev (frontend)
#                  https://api.mockmail.dev (API)
#
# Uso:
#   ./deploy.sh                    # Deploy para ambiente atual
#   ./deploy.sh --env=homologacao  # Deploy para homologação
#   ./deploy.sh --env=producao     # Deploy para produção
#   ./deploy.sh --branch=feature   # Deploy de branch específica
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

# Diretórios
API_DIR="$PROJECT_ROOT/api"
WATCH_DIR="$PROJECT_ROOT/watch"
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
    ["producao"]="master"
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
    echo "MockMail.dev - Script de Deploy Completo"
    echo ""
    echo "Uso: ./deploy.sh [opções]"
    echo ""
    echo "Opções:"
    echo "  --env=ENV        Ambiente: homologacao (default) ou producao"
    echo "  --branch=BRANCH  Branch específica para deploy"
    echo "  --skip-deps      Pular instalação de dependências"
    echo "  --skip-build     Pular build (apenas pull e restart)"
    echo "  --dry-run        Simular sem aplicar mudanças"
    echo "  --help           Exibir esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  ./deploy.sh                         # Deploy homologação"
    echo "  ./deploy.sh --env=producao          # Deploy produção"
    echo "  ./deploy.sh --branch=feature/xyz    # Deploy de branch específica"
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
    [ ! -d "$API_DIR" ] && { log_error "Diretório API não encontrado: $API_DIR"; exit 1; }
    [ ! -d "$WATCH_DIR" ] && { log_error "Diretório Watch não encontrado: $WATCH_DIR"; exit 1; }
    log_success "Estrutura do projeto OK"
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
    log_info "Commit atual: $CURRENT_COMMIT"

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
        log_info "[DRY RUN] Simulando git fetch e checkout..."
        git fetch origin
        log_info "Branch: $BRANCH"
        git log origin/$BRANCH --oneline -5
        return 0
    fi

    # Fetch
    log_info "Buscando atualizações..."
    git fetch origin

    # Verificar se branch existe
    if ! git rev-parse --verify "origin/$BRANCH" &>/dev/null; then
        log_error "Branch não encontrada: $BRANCH"
        exit 1
    fi

    # Checkout da branch
    log_info "Mudando para branch: $BRANCH"
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"

    # Pull
    log_info "Aplicando atualizações..."
    git pull origin "$BRANCH"

    NEW_COMMIT=$(git rev-parse HEAD)
    log_success "Código atualizado: $(git log --oneline -1)"
}

# Instalar dependências da API
install_api_deps() {
    log_step "Instalando dependências da API"

    cd "$API_DIR"

    if [ "$SKIP_DEPS" = true ]; then
        log_info "Pulando instalação de dependências (--skip-deps)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] npm install"
        return 0
    fi

    npm install
    log_success "Dependências da API instaladas"
}

# Build da API
build_api() {
    log_step "Compilando API"

    cd "$API_DIR"

    if [ "$SKIP_BUILD" = true ]; then
        log_info "Pulando build (--skip-build)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] npm run build"
        return 0
    fi

    # Limpar build anterior
    rm -rf dist/

    npm run build
    log_success "API compilada"
}

# Instalar dependências do Watch
install_watch_deps() {
    log_step "Instalando dependências do Watch (Frontend)"

    cd "$WATCH_DIR"

    if [ "$SKIP_DEPS" = true ]; then
        log_info "Pulando instalação de dependências (--skip-deps)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] npm install"
        return 0
    fi

    npm install
    log_success "Dependências do Watch instaladas"
}

# Build do Watch
build_watch() {
    log_step "Compilando Watch (Frontend)"

    cd "$WATCH_DIR"

    if [ "$SKIP_BUILD" = true ]; then
        log_info "Pulando build (--skip-build)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] npm run build"
        return 0
    fi

    # Limpar build anterior
    rm -rf .next/

    # Definir variáveis de ambiente para build
    export NEXT_PUBLIC_API_URL="${API_URLS[$ENVIRONMENT]}"

    npm run build
    log_success "Watch compilado"
}

# Atualizar Email Processor
update_email_processor() {
    log_step "Atualizando Email Processor"

    if [ ! -d "$EMAIL_PROCESSOR_DIR" ]; then
        log_warning "Diretório email-processor não encontrado, pulando..."
        return 0
    fi

    cd "$EMAIL_PROCESSOR_DIR"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Atualizando email processor..."
        return 0
    fi

    if [ -f "email_processor.py" ]; then
        sudo cp email_processor.py /opt/mockmail/ 2>/dev/null || log_warning "Não foi possível copiar email_processor.py"
        log_success "Email processor atualizado"
    fi

    if [ -f "email-handler.sh" ]; then
        sudo cp email-handler.sh /usr/local/bin/ 2>/dev/null || log_warning "Não foi possível copiar email-handler.sh"
        sudo chmod +x /usr/local/bin/email-handler.sh 2>/dev/null || true
        log_success "Email handler atualizado"
    fi
}

# Configurar PM2
setup_pm2() {
    log_step "Configurando PM2"

    cd "$PROJECT_ROOT"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Configurando PM2..."
        return 0
    fi

    # Criar ecosystem se não existir
    if [ ! -f "ecosystem.config.js" ]; then
        log_info "Criando ecosystem.config.js..."
        cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'mockmail-api',
      cwd: './api',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'mockmail-watch',
      cwd: './watch',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
EOF
        log_success "ecosystem.config.js criado"
    fi
}

# Reiniciar serviços
restart_services() {
    log_step "Reiniciando serviços PM2"

    cd "$PROJECT_ROOT"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] pm2 restart/reload..."
        return 0
    fi

    # Verificar se apps já existem no PM2
    if pm2 list | grep -q "mockmail-api"; then
        log_info "Recarregando serviços existentes..."
        pm2 reload ecosystem.config.js --update-env
    else
        log_info "Iniciando serviços..."
        pm2 start ecosystem.config.js
    fi

    # Salvar configuração PM2
    pm2 save

    log_success "Serviços PM2 reiniciados"
}

# Reiniciar Email Processor
restart_email_processor() {
    log_step "Reiniciando Email Processor"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Reiniciando email-processor..."
        return 0
    fi

    if sudo systemctl is-active --quiet email-processor 2>/dev/null; then
        sudo systemctl restart email-processor
        log_success "Email processor reiniciado"
    else
        log_warning "Email processor não está rodando como serviço"
    fi
}

# Verificar saúde dos serviços
health_check() {
    log_step "Verificando saúde dos serviços"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Verificação de saúde..."
        return 0
    fi

    sleep 5

    local ALL_OK=true

    # Verificar PM2
    PM2_ONLINE=$(pm2 jlist 2>/dev/null | jq '[.[] | select(.pm2_env.status=="online")] | length' || echo "0")
    PM2_TOTAL=$(pm2 jlist 2>/dev/null | jq 'length' || echo "0")

    if [ "$PM2_ONLINE" -eq "$PM2_TOTAL" ] && [ "$PM2_TOTAL" -gt 0 ]; then
        log_success "PM2: $PM2_ONLINE/$PM2_TOTAL online"
    else
        log_error "PM2: $PM2_ONLINE/$PM2_TOTAL online"
        ALL_OK=false
    fi

    # Verificar API
    if curl -s -f http://localhost:3000/api/csrf-token > /dev/null 2>&1; then
        log_success "API: OK (localhost:3000)"
    else
        log_error "API: FALHOU"
        ALL_OK=false
    fi

    # Verificar Watch
    if curl -s -f http://localhost:3001 > /dev/null 2>&1; then
        log_success "Watch: OK (localhost:3001)"
    else
        log_warning "Watch: Não responde (pode estar iniciando...)"
    fi

    if [ "$ALL_OK" = false ]; then
        log_error "Alguns serviços falharam! Verifique: pm2 logs"
        return 1
    fi

    return 0
}

# Executar diagnóstico
run_diagnostics() {
    log_step "Executando diagnóstico"

    if [ -f "$PROJECT_ROOT/scripts/diagnostico-producao.sh" ]; then
        chmod +x "$PROJECT_ROOT/scripts/diagnostico-producao.sh"

        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY RUN] Executando diagnóstico..."
            return 0
        fi

        "$PROJECT_ROOT/scripts/diagnostico-producao.sh" "${API_URLS[$ENVIRONMENT]}" || true
    else
        log_warning "Script de diagnóstico não encontrado"
    fi
}

# Exibir resumo
show_summary() {
    separator
    echo -e "${GREEN}🚀 DEPLOY CONCLUÍDO - MockMail.dev${NC}"
    separator

    echo -e "📊 Ambiente: ${CYAN}$ENVIRONMENT${NC}"
    echo -e "📌 Branch: ${CYAN}$BRANCH${NC}"
    echo ""
    echo -e "🌐 URLs:"
    echo -e "   Frontend: ${GREEN}${FRONTEND_URLS[$ENVIRONMENT]}${NC}"
    echo -e "   API:      ${GREEN}${API_URLS[$ENVIRONMENT]}${NC}"
    echo ""
    echo -e "📝 Commit:"
    cd "$PROJECT_ROOT"
    git log --oneline -1
    echo ""
    echo -e "📦 Status PM2:"
    pm2 list | grep mockmail || true
    echo ""
    echo -e "🔧 Comandos úteis:"
    echo -e "   pm2 logs mockmail-api      # Logs da API"
    echo -e "   pm2 logs mockmail-watch    # Logs do frontend"
    echo -e "   pm2 monit                  # Monitoramento"
    echo -e "   ./deploy-hot.sh            # Deploy rápido"

    separator
}

# =============================================================================
# MAIN
# =============================================================================

parse_args "$@"

separator
echo -e "${GREEN}████████████████████████████████████████████████████████████████${NC}"
echo -e "${GREEN}█                                                              █${NC}"
echo -e "${GREEN}█   ${CYAN}MockMail.dev - Deploy Completo${GREEN}                            █${NC}"
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
create_backup
update_code
install_api_deps
build_api
install_watch_deps
build_watch
update_email_processor
setup_pm2
restart_services
restart_email_processor

# Aguardar estabilização
log_info "Aguardando estabilização dos serviços..."
sleep 5

health_check
# run_diagnostics  # Descomente para executar diagnóstico automático

show_summary

log_success "🎉 Deploy concluído com sucesso!"
