#!/bin/bash
# =============================================================================
# HOT DEPLOY - CRM Grupo Souza Monteiro
# =============================================================================
# Deploy seguro para horário comercial - SEM DOWNTIME
#
# Características:
#   - Zero downtime (usa PM2 reload graceful)
#   - Backup automático antes de aplicar mudanças
#   - Rollback automático em caso de falha
#   - Validação de saúde antes e depois
#   - DETECÇÃO AUTOMÁTICA de mudanças frontend/backend
#   - Limpeza de cache para garantir código novo
#
# Uso:
#   ./deploy-hot.sh                    # Auto-detecta o que precisa rebuild
#   ./deploy-hot.sh --force            # Força deploy mesmo sem mudanças pendentes
#   ./deploy-hot.sh --backend-only     # Força apenas backend (ignora frontend)
#   ./deploy-hot.sh --frontend         # Força rebuild do frontend
#   ./deploy-hot.sh --dry-run          # Simula sem aplicar
#   ./deploy-hot.sh --rollback         # Volta para versão anterior
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

# Diretórios
PROJECT_ROOT="/home/cortexflow/crm-monteiro-souza"
BACKEND_DIR="$PROJECT_ROOT/gsm-2.0/backend"
FRONTEND_DIR="$PROJECT_ROOT/gsm-2.0/frontend"
BACKUP_DIR="$PROJECT_ROOT/.hot-deploy-backups"
LOCKFILE="/tmp/hot-deploy.lock"

# Configurações
MAX_BACKUPS=5
HEALTH_CHECK_TIMEOUT=30
RELOAD_WAIT=5

# Flags
INCLUDE_FRONTEND=false
FORCE_BACKEND_ONLY=false
DRY_RUN=false
ROLLBACK_MODE=false
FORCE_DEPLOY=false
HAS_BACKEND_CHANGES=false
HAS_FRONTEND_CHANGES=false

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

# Verificar se outro deploy está rodando
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
    local status=$(pm2 jlist 2>/dev/null | node -e "
        const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
        const svc = data.find(p => p.name === '$service');
        console.log(svc ? svc.pm2_env.status : 'not_found');
    " 2>/dev/null)
    echo "$status"
}

# Criar backup
create_backup() {
    log_step "Criando backup de segurança"

    mkdir -p "$BACKUP_DIR"

    BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

    # Salvar commit atual
    cd "$PROJECT_ROOT"
    CURRENT_COMMIT=$(git rev-parse HEAD)
    echo "$CURRENT_COMMIT" > "$BACKUP_PATH.commit"

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

# Rollback para backup anterior
do_rollback() {
    log_step "Executando ROLLBACK"

    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Nenhum backup encontrado!"
        exit 1
    fi

    # Listar backups disponíveis
    echo -e "\nBackups disponíveis:"
    cd "$BACKUP_DIR"
    BACKUPS=($(ls -t *.commit 2>/dev/null | head -5))

    if [ ${#BACKUPS[@]} -eq 0 ]; then
        log_error "Nenhum backup encontrado!"
        exit 1
    fi

    for i in "${!BACKUPS[@]}"; do
        COMMIT=$(cat "${BACKUPS[$i]}")
        BACKUP_DATE=$(echo "${BACKUPS[$i]}" | sed 's/backup_\([0-9]*\)_\([0-9]*\).commit/\1 \2/' | sed 's/\(....\)\(..\)\(..\) \(..\)\(..\)\(..\)/\3\/\2\/\1 \4:\5:\6/')
        echo -e "  ${GREEN}[$i]${NC} $BACKUP_DATE - $(cd $PROJECT_ROOT && git log --oneline -1 $COMMIT 2>/dev/null || echo $COMMIT)"
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

    # Verificar se commit existe
    if ! git cat-file -e "$ROLLBACK_COMMIT" 2>/dev/null; then
        log_error "Commit não encontrado no repositório!"
        exit 1
    fi

    # Fazer checkout do commit
    git checkout "$ROLLBACK_COMMIT" -- gsm-2.0/backend/src gsm-2.0/frontend/src 2>/dev/null || {
        log_error "Falha ao restaurar arquivos!"
        exit 1
    }

    # Limpar caches
    log_info "Limpando caches..."
    rm -rf "$BACKEND_DIR/node_modules/.cache" 2>/dev/null || true
    rm -rf "$FRONTEND_DIR/.next" "$FRONTEND_DIR/node_modules/.cache" 2>/dev/null || true

    # Rebuild frontend se necessário
    log_info "Reconstruindo frontend..."
    cd "$FRONTEND_DIR"
    npm run build || log_warning "Build do frontend falhou"

    # Reload serviços
    log_info "Recarregando serviços..."
    pm2 reload gsm-backend gsm-frontend --update-env 2>/dev/null || true

    sleep $RELOAD_WAIT

    if check_health "backend" "4000" "/health"; then
        log_success "Rollback concluído com sucesso!"
    else
        log_error "Rollback aplicado, mas serviço não está saudável!"
        log_warning "Verifique os logs: pm2 logs gsm-backend"
        exit 1
    fi
}

# Verificar mudanças pendentes
check_changes() {
    cd "$PROJECT_ROOT"

    git fetch origin 2>/dev/null

    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/producao-gsm)

    if [ "$LOCAL" = "$REMOTE" ]; then
        if [ "$FORCE_DEPLOY" = true ]; then
            log_hot "Modo FORCE: Ignorando verificação de mudanças"
            HAS_BACKEND_CHANGES=true
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

    # Detectar mudanças no backend
    BACKEND_FILE_CHANGES=$(git diff $LOCAL..$REMOTE --name-only | grep "gsm-2.0/backend/" | wc -l)
    if [ "$BACKEND_FILE_CHANGES" -gt 0 ]; then
        HAS_BACKEND_CHANGES=true
        echo -e "\n${BLUE}Backend:${NC} $BACKEND_FILE_CHANGES arquivos modificados"
    fi

    # Detectar mudanças no frontend
    FRONTEND_FILE_CHANGES=$(git diff $LOCAL..$REMOTE --name-only | grep "gsm-2.0/frontend/" | wc -l)
    if [ "$FRONTEND_FILE_CHANGES" -gt 0 ]; then
        HAS_FRONTEND_CHANGES=true
        echo -e "${BLUE}Frontend:${NC} $FRONTEND_FILE_CHANGES arquivos modificados"

        # Listar arquivos do frontend modificados
        echo -e "\n${CYAN}Arquivos frontend modificados:${NC}"
        git diff $LOCAL..$REMOTE --name-only | grep "gsm-2.0/frontend/" | head -10

        # AUTO-HABILITAR frontend se houver mudanças e não for --backend-only
        if [ "$FORCE_BACKEND_ONLY" = false ]; then
            INCLUDE_FRONTEND=true
            echo -e "\n${MAGENTA}[AUTO]${NC} Frontend será reconstruído automaticamente"
        else
            log_warning "Frontend ignorado (--backend-only especificado)"
        fi
    fi

    # Verificar se há mudanças no schema do Prisma
    if git diff $LOCAL..$REMOTE --name-only | grep -q "prisma/schema.prisma"; then
        echo ""
        log_warning "⚠️  ATENÇÃO: Há mudanças no schema do banco de dados!"
        log_warning "Recomendado usar ./deploy.sh completo para aplicar migrations"
        read -p "Continuar mesmo assim? (s/N): " CONTINUE
        if [[ ! "${CONTINUE:-N}" =~ ^[Ss]$ ]]; then
            log_info "Deploy cancelado."
            return 1
        fi
    fi

    # Verificar se há mudanças no package.json
    if git diff $LOCAL..$REMOTE --name-only | grep -q "package.json"; then
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

    # Guardar commit atual para possível rollback
    PREVIOUS_COMMIT=$(git rev-parse HEAD)

    if [ "$DRY_RUN" = true ]; then
        log_hot "DRY RUN: Simulando git pull..."
        git fetch origin
        git diff HEAD..origin/producao-gsm --stat
        return 0
    fi

    # Pull das mudanças
    log_info "Usando mudanças locais (git pull ignorado)..."
# SKIPPED:     git pull origin producao-gsm || {
# SKIPPED:         log_error "Falha no git pull!"
# SKIPPED:         exit 1
# SKIPPED:     }

    NEW_COMMIT=$(git rev-parse HEAD)
    log_success "Código atualizado: $(git log --oneline -1)"

    echo "$PREVIOUS_COMMIT" > "$BACKUP_DIR/last_deploy.rollback"
}

# Limpar caches (CRÍTICO para garantir código novo)
clear_caches() {
    log_step "Limpando caches"

    if [ "$DRY_RUN" = true ]; then
        log_hot "DRY RUN: Simulando limpeza de caches..."
        return 0
    fi

    # Backend cache
    if [ "$HAS_BACKEND_CHANGES" = true ]; then
        log_info "Limpando cache do backend..."
        rm -rf "$BACKEND_DIR/node_modules/.cache" 2>/dev/null || true
        log_success "Cache backend limpo"
    fi

    # Frontend cache (sempre limpa se vai rebuildar)
    if [ "$INCLUDE_FRONTEND" = true ]; then
        log_info "Limpando cache do frontend..."
        rm -rf "$FRONTEND_DIR/.next" 2>/dev/null || true
        rm -rf "$FRONTEND_DIR/node_modules/.cache" 2>/dev/null || true
        log_success "Cache frontend limpo"
    fi
}

# Reload do backend (graceful)
reload_backend() {
    if [ "$HAS_BACKEND_CHANGES" = false ] && [ "$HAS_FRONTEND_CHANGES" = false ]; then
        log_info "Nenhuma mudança no backend detectada"
        return 0
    fi

    log_step "Recarregando Backend (Zero Downtime)"

    if [ "$DRY_RUN" = true ]; then
        log_hot "DRY RUN: Simulando pm2 reload gsm-backend..."
        return 0
    fi

    # Verificar status atual
    CURRENT_STATUS=$(check_pm2_status "gsm-backend")
    if [ "$CURRENT_STATUS" != "online" ]; then
        log_warning "Backend não está online (status: $CURRENT_STATUS)"
        log_info "Tentando iniciar..."
        pm2 start gsm-backend 2>/dev/null || pm2 restart gsm-backend
    fi

    # Reload graceful (mantém conexões existentes)
    log_info "Executando reload graceful..."
    pm2 reload gsm-backend --update-env

    # Aguardar estabilização
    log_info "Aguardando estabilização ($RELOAD_WAIT segundos)..."
    sleep $RELOAD_WAIT

    # Verificar saúde
    log_info "Verificando saúde do serviço..."
    if check_health "backend" "4000" "/health"; then
        log_success "Backend recarregado com sucesso!"
    else
        log_error "Backend não está respondendo!"
        log_warning "Tentando rollback automático..."

        if [ -f "$BACKUP_DIR/last_deploy.rollback" ]; then
            ROLLBACK_COMMIT=$(cat "$BACKUP_DIR/last_deploy.rollback")
            cd "$PROJECT_ROOT"
            git checkout "$ROLLBACK_COMMIT" -- gsm-2.0/backend/src
            rm -rf "$BACKEND_DIR/node_modules/.cache" 2>/dev/null || true
            pm2 reload gsm-backend --update-env
            sleep $RELOAD_WAIT

            if check_health "backend" "4000" "/health"; then
                log_warning "Rollback automático executado!"
                log_error "Deploy falhou, mas sistema foi restaurado."
            else
                log_error "Rollback também falhou! Verifique manualmente."
            fi
        fi

        exit 1
    fi
}

# Rebuild do frontend (se necessário)
rebuild_frontend() {
    if [ "$INCLUDE_FRONTEND" = false ]; then
        if [ "$HAS_FRONTEND_CHANGES" = true ]; then
            log_warning "Há mudanças no frontend mas rebuild foi ignorado (--backend-only)"
        fi
        return 0
    fi

    log_step "Reconstruindo Frontend"

    if [ "$DRY_RUN" = true ]; then
        log_hot "DRY RUN: Simulando npm run build..."
        return 0
    fi

    cd "$FRONTEND_DIR"

    # Build
    log_info "Executando build..."
    npm run build || {
        log_error "Build do frontend falhou!"
        log_warning "Tentando rollback..."

        if [ -f "$BACKUP_DIR/last_deploy.rollback" ]; then
            ROLLBACK_COMMIT=$(cat "$BACKUP_DIR/last_deploy.rollback")
            cd "$PROJECT_ROOT"
            git checkout "$ROLLBACK_COMMIT" -- gsm-2.0/frontend/src
            cd "$FRONTEND_DIR"
            rm -rf .next node_modules/.cache
            npm run build || log_error "Rollback do frontend também falhou!"
        fi

        exit 1
    }

    log_success "Frontend compilado!"

    # Reload frontend
    log_info "Recarregando frontend..."
    pm2 reload gsm-frontend --update-env

    sleep $RELOAD_WAIT

    if check_health "frontend" "3000" "/"; then
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

    # Backend
    if check_health "backend" "4000" "/health"; then
        log_success "Backend: OK"
    else
        log_error "Backend: FALHOU"
        ALL_OK=false
    fi

    # Frontend
    if check_health "frontend" "3000" "/"; then
        log_success "Frontend: OK"
    else
        log_warning "Frontend: Não responde (pode estar iniciando)"
    fi

    # Banco de dados
    cd "$BACKEND_DIR"
    if node -e "const{PrismaClient}=require('@prisma/client');new PrismaClient().\$connect().then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
        log_success "Banco de dados: OK"
    else
        log_error "Banco de dados: FALHOU"
        ALL_OK=false
    fi

    if [ "$ALL_OK" = false ]; then
        log_error "Validação falhou! Verifique os logs."
        exit 1
    fi

    log_success "Todas as validações passaram!"
}

# Exibir resumo
show_summary() {
    separator
    echo -e "${GREEN}🚀 HOT DEPLOY CONCLUÍDO${NC}"
    separator

    echo -e "📊 Status dos serviços:"
    pm2 list | grep -E "gsm-backend|gsm-frontend" || true

    echo -e "\n📝 Commit atual:"
    cd "$PROJECT_ROOT"
    git log --oneline -1

    echo -e "\n📦 O que foi atualizado:"
    [ "$HAS_BACKEND_CHANGES" = true ] && echo -e "   ${GREEN}✓${NC} Backend"
    [ "$INCLUDE_FRONTEND" = true ] && echo -e "   ${GREEN}✓${NC} Frontend (rebuild completo)"

    echo -e "\n🔧 Comandos úteis:"
    echo -e "   pm2 logs gsm-backend        # Ver logs do backend"
    echo -e "   pm2 logs gsm-frontend       # Ver logs do frontend"
    echo -e "   ./deploy-hot.sh --rollback  # Reverter mudanças"

    separator
}

# =============================================================================
# MAIN
# =============================================================================

# Parse argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --frontend)
            INCLUDE_FRONTEND=true
            shift
            ;;
        --backend-only)
            FORCE_BACKEND_ONLY=true
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
            echo "Uso: ./deploy-hot.sh [opções]"
            echo ""
            echo "Opções:"
            echo "  (sem opção)     Auto-detecta mudanças e rebuilda o necessário"
            echo "  --force         Força deploy mesmo sem mudanças pendentes do remoto"
            echo "  --frontend      Força rebuild do frontend mesmo sem mudanças"
            echo "  --backend-only  Ignora mudanças no frontend (apenas backend)"
            echo "  --dry-run       Simular sem aplicar mudanças"
            echo "  --rollback      Reverter para versão anterior"
            echo "  --help          Exibir esta ajuda"
            echo ""
            echo "Exemplos:"
            echo "  ./deploy-hot.sh              # Detecta automaticamente"
            echo "  ./deploy-hot.sh --force      # Força reload mesmo sem mudanças"
            echo "  ./deploy-hot.sh --force --frontend  # Força reload de tudo"
            echo "  ./deploy-hot.sh --dry-run    # Ver o que seria feito"
            echo "  ./deploy-hot.sh --rollback   # Reverter último deploy"
            exit 0
            ;;
        *)
            log_error "Opção desconhecida: $1"
            exit 1
            ;;
    esac
done

# Verificações iniciais
[ ! -d "$PROJECT_ROOT" ] && { log_error "Diretório não encontrado: $PROJECT_ROOT"; exit 1; }

separator
echo -e "${MAGENTA}⚡ HOT DEPLOY - CRM GRUPO SOUZA MONTEIRO${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}   MODO: DRY RUN (simulação)${NC}"
fi
if [ "$FORCE_BACKEND_ONLY" = true ]; then
    echo -e "${YELLOW}   MODO: Backend only (ignora frontend)${NC}"
fi
if [ "$FORCE_DEPLOY" = true ]; then
    echo -e "${MAGENTA}   MODO: FORCE (ignora verificação de mudanças)${NC}"
fi
if [ "$INCLUDE_FRONTEND" = true ] && [ "$FORCE_BACKEND_ONLY" = false ]; then
    echo -e "${CYAN}   Incluindo: Frontend (forçado)${NC}"
fi
echo -e "${BLUE}   Auto-detecção: ATIVADA${NC}"
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

# Mostrar resumo do que será feito
echo ""
echo -e "${CYAN}━━━ Resumo do Deploy ━━━${NC}"
[ "$HAS_BACKEND_CHANGES" = true ] && echo -e "  ${GREEN}→${NC} Backend será recarregado"
[ "$INCLUDE_FRONTEND" = true ] && echo -e "  ${GREEN}→${NC} Frontend será reconstruído"
[ "$HAS_BACKEND_CHANGES" = false ] && [ "$HAS_FRONTEND_CHANGES" = false ] && echo -e "  ${YELLOW}→${NC} Nenhuma mudança significativa detectada"
echo ""

read -p "Aplicar mudanças? (S/n): " CONFIRM
if [[ "${CONFIRM:-S}" =~ ^[Nn]$ ]]; then
    log_info "Deploy cancelado."
    exit 0
fi

# Criar backup
BACKUP_NAME=$(create_backup)

# Aplicar mudanças
apply_changes

# Limpar caches (CRÍTICO!)
clear_caches

# Reload serviços
reload_backend
rebuild_frontend

# Validação
final_validation

# Resumo
show_summary

log_success "🎉 Deploy concluído sem downtime!"
