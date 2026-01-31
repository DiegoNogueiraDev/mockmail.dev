#!/bin/bash
# =============================================================================
# HOT DEPLOY - MockMail.dev
# =============================================================================
# Deploy rápido SEM DOWNTIME - ideal para horário comercial
#
# Características:
#   - Zero downtime (usa PM2 reload graceful)
#   - Backup automático antes de aplicar mudanças
#   - Rollback automático em caso de falha
#   - Detecção automática de mudanças API/Frontend
#   - Limpeza de cache para garantir código novo
#
# Uso:
#   ./deploy-hot.sh                    # Auto-detecta o que precisa rebuild
#   ./deploy-hot.sh --force            # Força deploy mesmo sem mudanças
#   ./deploy-hot.sh --api-only         # Apenas API (ignora frontend)
#   ./deploy-hot.sh --frontend         # Força rebuild do frontend
#   ./deploy-hot.sh --dry-run          # Simula sem aplicar
#   ./deploy-hot.sh --rollback         # Volta para versão anterior
#   ./deploy-hot.sh --env=producao     # Deploy em produção
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
BACKUP_DIR="$PROJECT_ROOT/.hot-deploy-backups"
LOCKFILE="/tmp/mockmail-hot-deploy.lock"

# Configurações
MAX_BACKUPS=5
HEALTH_CHECK_TIMEOUT=30
RELOAD_WAIT=5

# Flags
ENVIRONMENT="homologacao"
INCLUDE_FRONTEND=false
FORCE_API_ONLY=false
DRY_RUN=false
ROLLBACK_MODE=false
FORCE_DEPLOY=false
HAS_API_CHANGES=false
HAS_FRONTEND_CHANGES=false

# URLs por ambiente
declare -A API_URLS=(
    ["homologacao"]="https://api.homologacao.mockmail.dev"
    ["producao"]="https://api.mockmail.dev"
)

declare -A BRANCHES=(
    ["homologacao"]="homologacao-mockmail"
    ["producao"]="master"
)

# Funções auxiliares
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
log_hot() { echo -e "${MAGENTA}[HOT]${NC} $1"; }

separator() {
    echo -e "\n${CYAN}════════════════════════════════════════════════════════════════════════════${NC}\n"
}

# Verificar lock
check_lock() {
    if [ -f "$LOCKFILE" ]; then
        LOCK_PID=$(cat "$LOCKFILE" 2>/dev/null)
        if ps -p "$LOCK_PID" > /dev/null 2>&1; then
            log_error "Outro deploy está em execução (PID: $LOCK_PID)"
            log_error "Se tem certeza que não há outro deploy, remova: rm $LOCKFILE"
            exit 1
        else
            log_warning "Lock órfão encontrado, removendo..."
            rm -f "$LOCKFILE"
        fi
    fi
    echo $$ > "$LOCKFILE"
    trap "rm -f $LOCKFILE" EXIT
}

# Verificar saúde do serviço
check_health() {
    local service=$1
    local port=$2
    local endpoint=$3

    for i in $(seq 1 $HEALTH_CHECK_TIMEOUT); do
        if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 --max-time 5 "http://localhost:$port$endpoint" 2>/dev/null | grep -q "^[23]"; then
            return 0
        fi
        sleep 1
    done
    return 1
}

# Verificar status PM2
check_pm2_status() {
    local service=$1
    local status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$service\") | .pm2_env.status" 2>/dev/null || echo "not_found")
    echo "$status"
}

# Criar backup
create_backup() {
    log_step "Criando backup de segurança"

    mkdir -p "$BACKUP_DIR"

    BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

    cd "$PROJECT_ROOT"
    CURRENT_COMMIT=$(git rev-parse HEAD)
    echo "$CURRENT_COMMIT" > "$BACKUP_PATH.commit"
    echo "$ENVIRONMENT" > "$BACKUP_PATH.env"

    # Salvar estado dos serviços
    pm2 jlist > "$BACKUP_PATH.pm2.json" 2>/dev/null || true

    log_success "Backup criado: $BACKUP_NAME"
    log_info "Commit atual: $(git log --oneline -1)"

    # Limpar backups antigos
    cd "$BACKUP_DIR"
    ls -t *.commit 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | while read f; do
        rm -f "${f%.commit}"* 2>/dev/null
    done

    echo "$BACKUP_NAME"
}

# Rollback
do_rollback() {
    log_step "Executando ROLLBACK"

    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Nenhum backup encontrado!"
        exit 1
    fi

    cd "$BACKUP_DIR"
    BACKUPS=($(ls -t *.commit 2>/dev/null | head -5))

    if [ ${#BACKUPS[@]} -eq 0 ]; then
        log_error "Nenhum backup encontrado!"
        exit 1
    fi

    echo -e "\nBackups disponíveis:"
    for i in "${!BACKUPS[@]}"; do
        COMMIT=$(cat "${BACKUPS[$i]}")
        ENV=$(cat "${BACKUPS[$i]%.commit}.env" 2>/dev/null || echo "unknown")
        BACKUP_DATE=$(echo "${BACKUPS[$i]}" | sed 's/backup_\([0-9]*\)_\([0-9]*\).commit/\1 \2/' | sed 's/\(....\)\(..\)\(..\) \(..\)\(..\)\(..\)/\3\/\2\/\1 \4:\5:\6/')
        echo -e "  ${GREEN}[$i]${NC} $BACKUP_DATE [$ENV] - $(cd $PROJECT_ROOT && git log --oneline -1 $COMMIT 2>/dev/null || echo $COMMIT)"
    done

    echo ""
    read -p "Selecione o backup (0-$((${#BACKUPS[@]}-1))) ou 'c' para cancelar: " CHOICE

    if [[ "$CHOICE" == "c" ]]; then
        log_info "Rollback cancelado."
        exit 0
    fi

    if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [ "$CHOICE" -ge ${#BACKUPS[@]} ]; then
        log_error "Opção inválida!"
        exit 1
    fi

    SELECTED_BACKUP="${BACKUPS[$CHOICE]}"
    ROLLBACK_COMMIT=$(cat "$SELECTED_BACKUP")

    log_warning "Fazendo rollback para commit: $ROLLBACK_COMMIT"
    read -p "Confirmar rollback? (s/N): " CONFIRM

    if [[ ! "${CONFIRM:-N}" =~ ^[Ss]$ ]]; then
        log_info "Rollback cancelado."
        exit 0
    fi

    cd "$PROJECT_ROOT"

    if ! git cat-file -e "$ROLLBACK_COMMIT" 2>/dev/null; then
        log_error "Commit não encontrado no repositório!"
        exit 1
    fi

    # Fazer checkout do commit
    git checkout "$ROLLBACK_COMMIT" -- api/src watch/app watch/components 2>/dev/null || {
        log_error "Falha ao restaurar arquivos!"
        exit 1
    }

    # Limpar caches
    log_info "Limpando caches..."
    rm -rf "$API_DIR/dist" 2>/dev/null || true
    rm -rf "$WATCH_DIR/.next" "$WATCH_DIR/node_modules/.cache" 2>/dev/null || true

    # Rebuild
    log_info "Reconstruindo API..."
    cd "$API_DIR"
    npm run build || log_warning "Build da API falhou"

    log_info "Reconstruindo frontend..."
    cd "$WATCH_DIR"
    npm run build || log_warning "Build do frontend falhou"

    # Reload serviços
    log_info "Recarregando serviços..."
    cd "$PROJECT_ROOT"
    pm2 reload mockmail-api mockmail-watch --update-env 2>/dev/null || pm2 reload all

    sleep $RELOAD_WAIT

    if check_health "api" "3000" "/api/csrf-token"; then
        log_success "Rollback concluído com sucesso!"
    else
        log_error "Rollback aplicado, mas serviço não está saudável!"
        log_warning "Verifique os logs: pm2 logs"
        exit 1
    fi
}

# Verificar mudanças pendentes
check_changes() {
    cd "$PROJECT_ROOT"

    BRANCH="${BRANCHES[$ENVIRONMENT]}"
    git fetch origin 2>/dev/null

    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "$LOCAL")

    if [ "$LOCAL" = "$REMOTE" ]; then
        if [ "$FORCE_DEPLOY" = true ]; then
            log_hot "Modo FORCE: Ignorando verificação de mudanças"
            HAS_API_CHANGES=true
            if [ "$INCLUDE_FRONTEND" = true ]; then
                HAS_FRONTEND_CHANGES=true
            fi
            return 0
        fi
        log_warning "Nenhuma mudança para aplicar (já está atualizado)"
        log_info "Use --force para forçar o deploy mesmo assim"
        return 1
    fi

    CHANGES=$(git log --oneline $LOCAL..$REMOTE 2>/dev/null | wc -l)
    log_info "Commits pendentes: $CHANGES"

    echo -e "\nMudanças a serem aplicadas:"
    git log --oneline $LOCAL..$REMOTE 2>/dev/null | head -10

    # Detectar mudanças na API
    API_FILE_CHANGES=$(git diff $LOCAL..$REMOTE --name-only 2>/dev/null | grep "api/" | wc -l)
    if [ "$API_FILE_CHANGES" -gt 0 ]; then
        HAS_API_CHANGES=true
        echo -e "\n${BLUE}API:${NC} $API_FILE_CHANGES arquivos modificados"
    fi

    # Detectar mudanças no frontend
    FRONTEND_FILE_CHANGES=$(git diff $LOCAL..$REMOTE --name-only 2>/dev/null | grep "watch/" | wc -l)
    if [ "$FRONTEND_FILE_CHANGES" -gt 0 ]; then
        HAS_FRONTEND_CHANGES=true
        echo -e "${BLUE}Frontend:${NC} $FRONTEND_FILE_CHANGES arquivos modificados"

        if [ "$FORCE_API_ONLY" = false ]; then
            INCLUDE_FRONTEND=true
            echo -e "\n${MAGENTA}[AUTO]${NC} Frontend será reconstruído automaticamente"
        else
            log_warning "Frontend ignorado (--api-only especificado)"
        fi
    fi

    # Verificar mudanças críticas
    if git diff $LOCAL..$REMOTE --name-only 2>/dev/null | grep -q "package.json"; then
        echo ""
        log_warning "⚠️  ATENÇÃO: Há mudanças em dependências (package.json)!"
        log_warning "Recomendado usar ./deploy.sh completo para instalar dependências"
        read -p "Continuar mesmo assim? (s/N): " CONTINUE
        if [[ ! "${CONTINUE:-N}" =~ ^[Ss]$ ]]; then
            log_info "Deploy cancelado."
            return 1
        fi
    fi

    return 0
}

# Aplicar mudanças
apply_changes() {
    log_step "Aplicando mudanças"

    cd "$PROJECT_ROOT"
    BRANCH="${BRANCHES[$ENVIRONMENT]}"

    PREVIOUS_COMMIT=$(git rev-parse HEAD)

    if [ "$DRY_RUN" = true ]; then
        log_hot "DRY RUN: Simulando git pull..."
        git fetch origin
        git diff HEAD..origin/$BRANCH --stat
        return 0
    fi

    # Pull das mudanças
    log_info "Aplicando mudanças da branch $BRANCH..."
    git pull origin "$BRANCH" || {
        log_error "Falha no git pull!"
        exit 1
    }

    NEW_COMMIT=$(git rev-parse HEAD)
    log_success "Código atualizado: $(git log --oneline -1)"

    echo "$PREVIOUS_COMMIT" > "$BACKUP_DIR/last_deploy.rollback"
}

# Limpar caches
clear_caches() {
    log_step "Limpando caches"

    if [ "$DRY_RUN" = true ]; then
        log_hot "DRY RUN: Simulando limpeza de caches..."
        return 0
    fi

    # API cache
    if [ "$HAS_API_CHANGES" = true ]; then
        log_info "Limpando cache da API..."
        rm -rf "$API_DIR/dist" 2>/dev/null || true
        log_success "Cache API limpo"
    fi

    # Frontend cache
    if [ "$INCLUDE_FRONTEND" = true ]; then
        log_info "Limpando cache do frontend..."
        rm -rf "$WATCH_DIR/.next" 2>/dev/null || true
        rm -rf "$WATCH_DIR/node_modules/.cache" 2>/dev/null || true
        log_success "Cache frontend limpo"
    fi
}

# Build e reload da API
reload_api() {
    if [ "$HAS_API_CHANGES" = false ] && [ "$FORCE_DEPLOY" = false ]; then
        log_info "Nenhuma mudança na API detectada"
        return 0
    fi

    log_step "Recompilando e Recarregando API (Zero Downtime)"

    if [ "$DRY_RUN" = true ]; then
        log_hot "DRY RUN: Simulando build e reload da API..."
        return 0
    fi

    # Build
    log_info "Compilando API..."
    cd "$API_DIR"
    npm run build || {
        log_error "Build da API falhou!"
        exit 1
    }
    log_success "API compilada"

    # Verificar status atual
    CURRENT_STATUS=$(check_pm2_status "mockmail-api")
    if [ "$CURRENT_STATUS" != "online" ]; then
        log_warning "API não está online (status: $CURRENT_STATUS)"
        log_info "Tentando iniciar..."
        cd "$PROJECT_ROOT"
        pm2 start ecosystem.config.js --only mockmail-api 2>/dev/null || pm2 restart mockmail-api
    fi

    # Reload graceful
    log_info "Executando reload graceful..."
    pm2 reload mockmail-api --update-env

    log_info "Aguardando estabilização ($RELOAD_WAIT segundos)..."
    sleep $RELOAD_WAIT

    # Verificar saúde
    log_info "Verificando saúde do serviço..."
    if check_health "api" "3000" "/api/csrf-token"; then
        log_success "API recarregada com sucesso!"
    else
        log_error "API não está respondendo!"
        log_warning "Tentando rollback automático..."

        if [ -f "$BACKUP_DIR/last_deploy.rollback" ]; then
            ROLLBACK_COMMIT=$(cat "$BACKUP_DIR/last_deploy.rollback")
            cd "$PROJECT_ROOT"
            git checkout "$ROLLBACK_COMMIT" -- api/src
            cd "$API_DIR"
            npm run build
            pm2 reload mockmail-api --update-env
            sleep $RELOAD_WAIT

            if check_health "api" "3000" "/api/csrf-token"; then
                log_warning "Rollback automático executado!"
                log_error "Deploy falhou, mas sistema foi restaurado."
            else
                log_error "Rollback também falhou! Verifique manualmente."
            fi
        fi

        exit 1
    fi
}

# Rebuild do frontend
rebuild_frontend() {
    if [ "$INCLUDE_FRONTEND" = false ]; then
        if [ "$HAS_FRONTEND_CHANGES" = true ]; then
            log_warning "Há mudanças no frontend mas rebuild foi ignorado (--api-only)"
        fi
        return 0
    fi

    log_step "Reconstruindo Frontend"

    if [ "$DRY_RUN" = true ]; then
        log_hot "DRY RUN: Simulando npm run build..."
        return 0
    fi

    cd "$WATCH_DIR"

    # Definir variáveis de ambiente
    export NEXT_PUBLIC_API_URL="${API_URLS[$ENVIRONMENT]}"

    # Build
    log_info "Executando build..."
    npm run build || {
        log_error "Build do frontend falhou!"
        exit 1
    }

    log_success "Frontend compilado!"

    # Reload frontend
    log_info "Recarregando frontend..."
    pm2 reload mockmail-watch --update-env

    sleep $RELOAD_WAIT

    if check_health "frontend" "3001" "/"; then
        log_success "Frontend recarregado com sucesso!"
    else
        log_warning "Frontend pode estar demorando para iniciar..."
    fi
}

# Validação final
final_validation() {
    log_step "Validação Final"

    if [ "$DRY_RUN" = true ]; then
        log_hot "DRY RUN: Simulando validação..."
        return 0
    fi

    local ALL_OK=true

    # API
    if check_health "api" "3000" "/api/csrf-token"; then
        log_success "API: OK"
    else
        log_error "API: FALHOU"
        ALL_OK=false
    fi

    # Frontend
    if check_health "frontend" "3001" "/"; then
        log_success "Frontend: OK"
    else
        log_warning "Frontend: Não responde (pode estar iniciando)"
    fi

    if [ "$ALL_OK" = false ]; then
        log_error "Validação falhou! Verifique os logs: pm2 logs"
        exit 1
    fi

    log_success "Todas as validações passaram!"
}

# Resumo
show_summary() {
    separator
    echo -e "${GREEN}🚀 HOT DEPLOY CONCLUÍDO - MockMail.dev${NC}"
    separator

    echo -e "📊 Ambiente: ${CYAN}$ENVIRONMENT${NC}"
    echo ""
    echo -e "📦 O que foi atualizado:"
    [ "$HAS_API_CHANGES" = true ] && echo -e "   ${GREEN}✓${NC} API (build + reload)"
    [ "$INCLUDE_FRONTEND" = true ] && echo -e "   ${GREEN}✓${NC} Frontend (rebuild completo)"
    echo ""
    echo -e "📝 Commit atual:"
    cd "$PROJECT_ROOT"
    git log --oneline -1
    echo ""
    echo -e "🔧 Comandos úteis:"
    echo -e "   pm2 logs mockmail-api      # Logs da API"
    echo -e "   pm2 logs mockmail-watch    # Logs do frontend"
    echo -e "   ./deploy-hot.sh --rollback # Reverter mudanças"

    separator
}

# Parse argumentos
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env=*)
                ENVIRONMENT="${1#*=}"
                shift
                ;;
            --frontend)
                INCLUDE_FRONTEND=true
                shift
                ;;
            --api-only)
                FORCE_API_ONLY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --rollback)
                ROLLBACK_MODE=true
                shift
                ;;
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --help|-h)
                echo "MockMail.dev - Hot Deploy (Zero Downtime)"
                echo ""
                echo "Uso: ./deploy-hot.sh [opções]"
                echo ""
                echo "Opções:"
                echo "  --env=ENV     Ambiente: homologacao (default) ou producao"
                echo "  --force       Força deploy mesmo sem mudanças pendentes"
                echo "  --frontend    Força rebuild do frontend"
                echo "  --api-only    Ignora mudanças no frontend"
                echo "  --dry-run     Simular sem aplicar mudanças"
                echo "  --rollback    Reverter para versão anterior"
                echo "  --help        Exibir esta ajuda"
                exit 0
                ;;
            *)
                log_error "Opção desconhecida: $1"
                exit 1
                ;;
        esac
    done
}

# =============================================================================
# MAIN
# =============================================================================

parse_args "$@"

separator
echo -e "${MAGENTA}⚡ HOT DEPLOY - MockMail.dev${NC}"
echo ""
echo -e "   Ambiente: ${CYAN}$ENVIRONMENT${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "   ${YELLOW}MODO: DRY RUN (simulação)${NC}"
fi
if [ "$FORCE_API_ONLY" = true ]; then
    echo -e "   ${YELLOW}MODO: API only (ignora frontend)${NC}"
fi
if [ "$FORCE_DEPLOY" = true ]; then
    echo -e "   ${MAGENTA}MODO: FORCE (ignora verificação)${NC}"
fi
separator

# Verificar lock
check_lock

# Modo rollback
if [ "$ROLLBACK_MODE" = true ]; then
    do_rollback
    exit 0
fi

# Verificar mudanças
if ! check_changes; then
    exit 0
fi

# Resumo do que será feito
echo ""
echo -e "${CYAN}━━━ Resumo do Deploy ━━━${NC}"
[ "$HAS_API_CHANGES" = true ] && echo -e "  ${GREEN}→${NC} API será recompilada e recarregada"
[ "$INCLUDE_FRONTEND" = true ] && echo -e "  ${GREEN}→${NC} Frontend será reconstruído"
[ "$HAS_API_CHANGES" = false ] && [ "$HAS_FRONTEND_CHANGES" = false ] && echo -e "  ${YELLOW}→${NC} Nenhuma mudança significativa"
echo ""

read -p "Aplicar mudanças? (S/n): " CONFIRM
if [[ "${CONFIRM:-S}" =~ ^[Nn]$ ]]; then
    log_info "Deploy cancelado."
    exit 0
fi

# Executar
BACKUP_NAME=$(create_backup)
apply_changes
clear_caches
reload_api
rebuild_frontend
final_validation
show_summary

log_success "🎉 Hot deploy concluído sem downtime!"
