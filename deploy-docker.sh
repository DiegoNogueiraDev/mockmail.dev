#!/bin/bash
# =============================================================================
# DEPLOY DOCKER - MockMail.dev
# =============================================================================
# Deploy completo via Docker Compose com build limpo
#
# Características:
#   - Build limpo de todos os containers (--no-cache)
#   - Ambiente isolado por portas diferentes
#   - Suporte a homologação e produção
#   - Health checks automáticos
#   - Rollback via tags de imagem
#
# Uso:
#   ./deploy-docker.sh                     # Deploy homologação
#   ./deploy-docker.sh --env=producao      # Deploy produção
#   ./deploy-docker.sh --no-cache          # Force rebuild sem cache
#   ./deploy-docker.sh --only=api          # Rebuild apenas API
#   ./deploy-docker.sh --only=watch        # Rebuild apenas frontend
#   ./deploy-docker.sh --down              # Parar ambiente
#   ./deploy-docker.sh --logs              # Ver logs
#   ./deploy-docker.sh --status            # Ver status
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

# Detectar diretório
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Configurações padrão
ENVIRONMENT="homologacao"
NO_CACHE=false
ONLY_SERVICE=""
ACTION="deploy"
FOLLOW_LOGS=false

# Configurações por ambiente
declare -A COMPOSE_FILES=(
    ["homologacao"]="docker-compose.homologacao.yml"
    ["producao"]="docker-compose.producao.yml"
)

declare -A PROJECT_NAMES=(
    ["homologacao"]="mockmail-hml"
    ["producao"]="mockmail"
)

declare -A API_PORTS=(
    ["homologacao"]="3010"
    ["producao"]="3000"
)

declare -A WATCH_PORTS=(
    ["homologacao"]="3011"
    ["producao"]="3001"
)

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
log_docker() { echo -e "${MAGENTA}[DOCKER]${NC} $1"; }

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
            --no-cache)
                NO_CACHE=true
                shift
                ;;
            --only=*)
                ONLY_SERVICE="${1#*=}"
                shift
                ;;
            --down)
                ACTION="down"
                shift
                ;;
            --logs)
                ACTION="logs"
                shift
                ;;
            --status)
                ACTION="status"
                shift
                ;;
            --restart)
                ACTION="restart"
                shift
                ;;
            --follow|-f)
                FOLLOW_LOGS=true
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
}

show_help() {
    echo "MockMail.dev - Deploy Docker"
    echo ""
    echo "Uso: ./deploy-docker.sh [opções]"
    echo ""
    echo "Opções:"
    echo "  --env=ENV       Ambiente: homologacao (default) ou producao"
    echo "  --no-cache      Force rebuild sem cache Docker"
    echo "  --only=SERVICE  Rebuild apenas: api, watch, mongodb, redis, postgres"
    echo "  --down          Parar todos os containers"
    echo "  --logs          Ver logs dos containers"
    echo "  --status        Ver status dos containers"
    echo "  --restart       Reiniciar containers"
    echo "  --follow, -f    Seguir logs após deploy"
    echo "  --help          Exibir esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  ./deploy-docker.sh                      # Deploy homologação"
    echo "  ./deploy-docker.sh --env=producao       # Deploy produção"
    echo "  ./deploy-docker.sh --no-cache           # Rebuild limpo"
    echo "  ./deploy-docker.sh --only=api           # Apenas API"
    echo "  ./deploy-docker.sh --logs -f            # Ver logs ao vivo"
}

# Obter compose file
get_compose_file() {
    echo "${COMPOSE_FILES[$ENVIRONMENT]}"
}

# Obter project name
get_project_name() {
    echo "${PROJECT_NAMES[$ENVIRONMENT]}"
}

# Detectar comando docker compose (v2 ou v1)
DOCKER_COMPOSE_CMD=""

detect_docker_compose() {
    # Tentar docker-compose (v1 - standalone) PRIMEIRO
    # Prioriza v1 pois é mais comum em servidores de produção
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
        return 0
    fi

    # Tentar docker compose (v2 - integrado ao Docker)
    # Usa subshell para evitar problemas com set -e
    if (docker compose version) &> /dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker compose"
        return 0
    fi

    return 1
}

# Comando docker compose base
docker_compose() {
    local compose_file=$(get_compose_file)
    local project_name=$(get_project_name)

    $DOCKER_COMPOSE_CMD -f "$PROJECT_ROOT/$compose_file" -p "$project_name" "$@"
}

# Verificar pré-requisitos
check_prerequisites() {
    log_step "Verificando pré-requisitos"

    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker não encontrado!"
        exit 1
    fi
    log_success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

    # Docker Compose (v2 ou v1)
    if ! detect_docker_compose; then
        log_error "Docker Compose não encontrado!"
        log_info "Instale com: sudo apt install docker-compose-plugin"
        log_info "Ou: sudo apt install docker-compose"
        exit 1
    fi

    if [ "$DOCKER_COMPOSE_CMD" = "docker compose" ]; then
        log_success "Docker Compose v2 ($($DOCKER_COMPOSE_CMD version --short 2>/dev/null || echo 'OK'))"
    else
        log_success "Docker Compose v1 ($($DOCKER_COMPOSE_CMD --version | cut -d' ' -f3 2>/dev/null || echo 'OK'))"
    fi

    # Verificar compose file
    local compose_file=$(get_compose_file)
    if [ ! -f "$PROJECT_ROOT/$compose_file" ]; then
        log_error "Arquivo $compose_file não encontrado!"
        exit 1
    fi
    log_success "Compose file: $compose_file"

    # Git
    if ! command -v git &> /dev/null; then
        log_error "Git não encontrado!"
        exit 1
    fi
    log_success "Git $(git --version | cut -d' ' -f3)"
}

# Atualizar código
update_code() {
    log_step "Atualizando código"

    cd "$PROJECT_ROOT"

    local branch="${BRANCHES[$ENVIRONMENT]}"

    log_info "Buscando atualizações..."
    git fetch origin

    # Verificar branch
    if ! git rev-parse --verify "origin/$branch" &>/dev/null; then
        log_error "Branch não encontrada: $branch"
        exit 1
    fi

    log_info "Mudando para branch: $branch"
    git checkout "$branch" 2>/dev/null || git checkout -b "$branch" "origin/$branch"

    log_info "Aplicando atualizações..."
    git pull origin "$branch"

    log_success "Código atualizado: $(git log --oneline -1)"
}

# Build dos containers
build_containers() {
    log_step "Build dos Containers"

    local build_args=""

    if [ "$NO_CACHE" = true ]; then
        build_args="--no-cache"
        log_docker "Build sem cache (--no-cache)"
    fi

    # Build arg com URL da API
    export NEXT_PUBLIC_API_URL="${API_URLS[$ENVIRONMENT]}"

    if [ -n "$ONLY_SERVICE" ]; then
        log_docker "Rebuilding apenas: $ONLY_SERVICE"
        docker_compose build $build_args "$ONLY_SERVICE"
    else
        log_docker "Rebuilding todos os serviços..."
        docker_compose build $build_args
    fi

    log_success "Build concluído!"
}

# Parar containers antigos
stop_containers() {
    log_step "Parando containers existentes"

    if [ -n "$ONLY_SERVICE" ]; then
        log_docker "Parando apenas: $ONLY_SERVICE"
        docker_compose stop "$ONLY_SERVICE" 2>/dev/null || true
        docker_compose rm -f "$ONLY_SERVICE" 2>/dev/null || true
    else
        log_docker "Parando todos os containers..."
        docker_compose down --remove-orphans 2>/dev/null || true
    fi

    log_success "Containers parados"
}

# Iniciar containers
start_containers() {
    log_step "Iniciando containers"

    if [ -n "$ONLY_SERVICE" ]; then
        log_docker "Iniciando apenas: $ONLY_SERVICE"
        docker_compose up -d "$ONLY_SERVICE"
    else
        log_docker "Iniciando todos os serviços..."
        docker_compose up -d
    fi

    log_success "Containers iniciados"
}

# Aguardar containers ficarem saudáveis
wait_for_health() {
    log_step "Aguardando containers ficarem saudáveis"

    local max_wait=120
    local waited=0

    while [ $waited -lt $max_wait ]; do
        local healthy=true

        # Verificar cada serviço
        local services=$(docker_compose ps --services 2>/dev/null)

        for service in $services; do
            local status=$(docker_compose ps --format json "$service" 2>/dev/null | jq -r '.[0].Health // "unknown"' 2>/dev/null || echo "unknown")

            if [ "$status" = "starting" ] || [ "$status" = "unknown" ]; then
                healthy=false
                break
            fi
        done

        if [ "$healthy" = true ]; then
            log_success "Todos os containers estão saudáveis!"
            return 0
        fi

        echo -n "."
        sleep 2
        waited=$((waited + 2))
    done

    echo ""
    log_warning "Timeout aguardando containers. Verificando status..."
    docker_compose ps
    return 1
}

# Verificar saúde dos serviços
health_check() {
    log_step "Verificação de Saúde"

    local api_port="${API_PORTS[$ENVIRONMENT]}"
    local watch_port="${WATCH_PORTS[$ENVIRONMENT]}"
    local all_ok=true

    # API
    if curl -s -f "http://localhost:$api_port/api/csrf-token" > /dev/null 2>&1; then
        log_success "API: OK (localhost:$api_port)"
    else
        log_error "API: FALHOU (localhost:$api_port)"
        all_ok=false
    fi

    # Watch
    if curl -s -f "http://localhost:$watch_port" > /dev/null 2>&1; then
        log_success "Watch: OK (localhost:$watch_port)"
    else
        log_warning "Watch: Não responde (pode estar iniciando)"
    fi

    # MongoDB
    if docker_compose exec -T mongodb-hml mongosh --eval "db.adminCommand('ping')" &>/dev/null 2>&1 || \
       docker_compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" &>/dev/null 2>&1; then
        log_success "MongoDB: OK"
    else
        log_warning "MongoDB: Verificar logs"
    fi

    # Redis
    if docker_compose exec -T redis-hml redis-cli ping &>/dev/null 2>&1 || \
       docker_compose exec -T redis redis-cli ping &>/dev/null 2>&1; then
        log_success "Redis: OK"
    else
        log_warning "Redis: Verificar logs"
    fi

    if [ "$all_ok" = false ]; then
        log_error "Alguns serviços falharam! Verifique os logs."
        return 1
    fi

    return 0
}

# Mostrar status
show_status() {
    log_step "Status dos Containers"

    docker_compose ps

    echo ""
    log_info "Para ver logs: ./deploy-docker.sh --logs"
}

# Mostrar logs
show_logs() {
    log_step "Logs dos Containers"

    if [ "$FOLLOW_LOGS" = true ]; then
        docker_compose logs -f
    else
        docker_compose logs --tail=100
    fi
}

# Parar ambiente
do_down() {
    log_step "Parando ambiente $ENVIRONMENT"

    docker_compose down --remove-orphans

    log_success "Ambiente parado"
}

# Reiniciar containers
do_restart() {
    log_step "Reiniciando containers"

    if [ -n "$ONLY_SERVICE" ]; then
        docker_compose restart "$ONLY_SERVICE"
    else
        docker_compose restart
    fi

    log_success "Containers reiniciados"
}

# Resumo do deploy
show_summary() {
    separator
    echo -e "${GREEN}🐳 DEPLOY DOCKER CONCLUÍDO - MockMail.dev${NC}"
    separator

    echo -e "📊 Ambiente: ${CYAN}$ENVIRONMENT${NC}"
    echo -e "📌 Branch: ${CYAN}${BRANCHES[$ENVIRONMENT]}${NC}"
    echo ""
    echo -e "🌐 URLs:"
    echo -e "   Frontend: ${GREEN}${FRONTEND_URLS[$ENVIRONMENT]}${NC}"
    echo -e "   API:      ${GREEN}${API_URLS[$ENVIRONMENT]}${NC}"
    echo ""
    echo -e "🔌 Portas locais:"
    echo -e "   API:      ${BLUE}localhost:${API_PORTS[$ENVIRONMENT]}${NC}"
    echo -e "   Watch:    ${BLUE}localhost:${WATCH_PORTS[$ENVIRONMENT]}${NC}"
    echo ""
    echo -e "📝 Commit:"
    cd "$PROJECT_ROOT"
    git log --oneline -1
    echo ""
    echo -e "📦 Containers:"
    docker_compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker_compose ps
    echo ""
    echo -e "🔧 Comandos úteis:"
    echo -e "   ./deploy-docker.sh --logs -f       # Ver logs ao vivo"
    echo -e "   ./deploy-docker.sh --status        # Ver status"
    echo -e "   ./deploy-docker.sh --restart       # Reiniciar"
    echo -e "   ./deploy-docker.sh --down          # Parar tudo"

    separator
}

# =============================================================================
# MAIN
# =============================================================================

parse_args "$@"

separator
echo -e "${MAGENTA}🐳 DOCKER DEPLOY - MockMail.dev${NC}"
echo ""
echo -e "   Ambiente: ${CYAN}$ENVIRONMENT${NC}"
echo -e "   Ação:     ${CYAN}$ACTION${NC}"
[ "$NO_CACHE" = true ] && echo -e "   ${YELLOW}Build sem cache ativado${NC}"
[ -n "$ONLY_SERVICE" ] && echo -e "   ${YELLOW}Apenas: $ONLY_SERVICE${NC}"
separator

# Executar ação
case $ACTION in
    deploy)
        check_prerequisites
        update_code
        stop_containers
        build_containers
        start_containers
        sleep 5
        wait_for_health || true
        health_check || true
        show_summary

        if [ "$FOLLOW_LOGS" = true ]; then
            show_logs
        fi

        log_success "🎉 Deploy Docker concluído!"
        ;;

    down)
        do_down
        ;;

    logs)
        show_logs
        ;;

    status)
        show_status
        ;;

    restart)
        do_restart
        wait_for_health || true
        health_check || true
        ;;
esac
