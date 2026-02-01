#!/bin/bash
# =============================================================================
# DEPLOY DOCKER - MockMail.dev (Infraestrutura)
# =============================================================================
# Gerencia apenas serviços de infraestrutura via Docker Compose
# (MongoDB, Redis, PostgreSQL)
#
# API e Frontend são gerenciados via PM2 (./deploy.sh)
#
# Uso:
#   ./deploy-docker.sh                     # Subir infra homologação
#   ./deploy-docker.sh --env=producao      # Subir infra produção
#   ./deploy-docker.sh --down              # Parar infra
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
ACTION="up"
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

# Portas por ambiente
declare -A MONGO_PORTS=(
    ["homologacao"]="27018"
    ["producao"]="27017"
)

declare -A REDIS_PORTS=(
    ["homologacao"]="6380"
    ["producao"]="6379"
)

declare -A POSTGRES_PORTS=(
    ["homologacao"]="5433"
    ["producao"]="5432"
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
    echo "MockMail.dev - Deploy Docker (Infraestrutura)"
    echo ""
    echo "Gerencia MongoDB, Redis e PostgreSQL via Docker."
    echo "API e Frontend são gerenciados via PM2 (./deploy.sh)"
    echo ""
    echo "Uso: ./deploy-docker.sh [opções]"
    echo ""
    echo "Opções:"
    echo "  --env=ENV       Ambiente: homologacao (default) ou producao"
    echo "  --down          Parar infraestrutura"
    echo "  --logs          Ver logs dos containers"
    echo "  --status        Ver status dos containers"
    echo "  --restart       Reiniciar containers"
    echo "  --follow, -f    Seguir logs"
    echo "  --help          Exibir esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  ./deploy-docker.sh                      # Subir infra homologação"
    echo "  ./deploy-docker.sh --env=producao       # Subir infra produção"
    echo "  ./deploy-docker.sh --down               # Parar infra"
    echo "  ./deploy-docker.sh --logs -f            # Ver logs ao vivo"
    echo ""
    echo "Depois de subir a infra, execute:"
    echo "  ./deploy.sh --env=homologacao           # Subir API/Frontend via PM2"
}

# Obter compose file
get_compose_file() {
    echo "${COMPOSE_FILES[$ENVIRONMENT]}"
}

# Obter project name
get_project_name() {
    echo "${PROJECT_NAMES[$ENVIRONMENT]}"
}

# Detectar comando docker compose
DOCKER_COMPOSE_CMD=""

detect_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
        return 0
    fi

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

    if ! command -v docker &> /dev/null; then
        log_error "Docker não encontrado!"
        exit 1
    fi
    log_success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

    if ! detect_docker_compose; then
        log_error "Docker Compose não encontrado!"
        exit 1
    fi

    if [ "$DOCKER_COMPOSE_CMD" = "docker compose" ]; then
        log_success "Docker Compose v2"
    else
        log_success "Docker Compose v1"
    fi

    local compose_file=$(get_compose_file)
    if [ ! -f "$PROJECT_ROOT/$compose_file" ]; then
        log_error "Arquivo $compose_file não encontrado!"
        exit 1
    fi
    log_success "Compose file: $compose_file"
}

# Subir infraestrutura
do_up() {
    log_step "Subindo infraestrutura"

    log_docker "Iniciando MongoDB, Redis, PostgreSQL..."
    docker_compose up -d

    log_success "Infraestrutura iniciada!"
}

# Parar infraestrutura
do_down() {
    log_step "Parando infraestrutura"

    docker_compose down --remove-orphans

    log_success "Infraestrutura parada"
}

# Reiniciar
do_restart() {
    log_step "Reiniciando infraestrutura"

    docker_compose restart

    log_success "Infraestrutura reiniciada"
}

# Verificar saúde
health_check() {
    log_step "Verificação de Saúde"

    local mongo_port="${MONGO_PORTS[$ENVIRONMENT]}"
    local redis_port="${REDIS_PORTS[$ENVIRONMENT]}"
    local postgres_port="${POSTGRES_PORTS[$ENVIRONMENT]}"

    sleep 3

    # MongoDB
    if docker_compose exec -T mongodb-hml mongosh --eval "db.adminCommand('ping')" &>/dev/null 2>&1 || \
       docker_compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" &>/dev/null 2>&1; then
        log_success "MongoDB: OK (porta $mongo_port)"
    else
        log_warning "MongoDB: Verificar logs"
    fi

    # Redis
    if docker_compose exec -T redis-hml redis-cli ping &>/dev/null 2>&1 || \
       docker_compose exec -T redis redis-cli ping &>/dev/null 2>&1; then
        log_success "Redis: OK (porta $redis_port)"
    else
        log_warning "Redis: Verificar logs"
    fi

    # PostgreSQL
    if docker_compose exec -T postgres-hml pg_isready &>/dev/null 2>&1 || \
       docker_compose exec -T postgres pg_isready &>/dev/null 2>&1; then
        log_success "PostgreSQL: OK (porta $postgres_port)"
    else
        log_warning "PostgreSQL: Verificar logs"
    fi
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

# Resumo
show_summary() {
    separator
    echo -e "${GREEN}🐳 INFRAESTRUTURA DOCKER - MockMail.dev${NC}"
    separator

    echo -e "📊 Ambiente: ${CYAN}$ENVIRONMENT${NC}"
    echo ""
    echo -e "🔌 Portas:"
    echo -e "   MongoDB:    ${BLUE}localhost:${MONGO_PORTS[$ENVIRONMENT]}${NC}"
    echo -e "   Redis:      ${BLUE}localhost:${REDIS_PORTS[$ENVIRONMENT]}${NC}"
    echo -e "   PostgreSQL: ${BLUE}localhost:${POSTGRES_PORTS[$ENVIRONMENT]}${NC}"
    echo ""
    echo -e "📦 Containers:"
    docker_compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || docker_compose ps
    echo ""
    echo -e "🔧 Próximo passo:"
    echo -e "   ${GREEN}./deploy.sh --env=$ENVIRONMENT${NC}  # Subir API/Frontend via PM2"
    echo ""
    echo -e "📝 Comandos úteis:"
    echo -e "   ./deploy-docker.sh --logs -f    # Ver logs ao vivo"
    echo -e "   ./deploy-docker.sh --status     # Ver status"
    echo -e "   ./deploy-docker.sh --down       # Parar tudo"

    separator
}

# =============================================================================
# MAIN
# =============================================================================

parse_args "$@"

separator
echo -e "${MAGENTA}🐳 DOCKER INFRA - MockMail.dev${NC}"
echo ""
echo -e "   Ambiente: ${CYAN}$ENVIRONMENT${NC}"
echo -e "   Ação:     ${CYAN}$ACTION${NC}"
separator

case $ACTION in
    up)
        check_prerequisites
        do_up
        health_check
        show_summary
        log_success "🎉 Infraestrutura pronta!"
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
        health_check
        ;;
esac
