#!/bin/bash

# =============================================================================
# Script para Resetar Senha de Usuário no MongoDB
# MockMail.dev
#
# Lê credenciais do .env e atualiza a senha de um usuário
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEFAULT_ENV_FILE="$PROJECT_ROOT/backend/.env"

# Senha padrão para reset
DEFAULT_PASSWORD="MockMail@2026"
# Hash bcrypt pré-gerado para a senha padrão (10 rounds)
DEFAULT_HASH='$2b$10$UB4qzjNOrMjca.M1TjecW.rCEVCQGyoGeA1N/SMLrCAtMWZp7YHyy'

show_help() {
    echo ""
    echo -e "${BLUE}=== MockMail.dev - Reset de Senha ===${NC}"
    echo ""
    echo "Reseta a senha de um usuário no MongoDB."
    echo ""
    echo "Uso: $0 [opções] <email>"
    echo ""
    echo "Opções:"
    echo "  -e, --env FILE    Arquivo .env com credenciais (padrão: ../backend/.env)"
    echo "  -c, --container   Nome do container MongoDB (auto-detecta)"
    echo "  --dry-run         Apenas simular, não executar"
    echo "  --help            Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  # Resetar senha de um usuário"
    echo "  $0 usuario@email.com"
    echo ""
    echo "  # Usar arquivo .env de homologação"
    echo "  $0 --env /path/to/.env usuario@email.com"
    echo ""
    echo -e "${YELLOW}Senha após reset: ${DEFAULT_PASSWORD}${NC}"
    echo ""
}

# Função para parsear MONGO_URI
parse_mongo_uri() {
    local uri="$1"
    local without_prefix="${uri#mongodb://}"

    if [[ "$without_prefix" =~ ^([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)\?(.+)$ ]]; then
        PARSED_USER="${BASH_REMATCH[1]}"
        PARSED_PASSWORD="${BASH_REMATCH[2]}"
        PARSED_HOST="${BASH_REMATCH[3]}"
        PARSED_PORT="${BASH_REMATCH[4]}"
        PARSED_DATABASE="${BASH_REMATCH[5]}"
        local params="${BASH_REMATCH[6]}"

        if [[ "$params" =~ authSource=([^&]+) ]]; then
            PARSED_AUTH_DB="${BASH_REMATCH[1]}"
        else
            PARSED_AUTH_DB="admin"
        fi
        return 0
    elif [[ "$without_prefix" =~ ^([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)$ ]]; then
        PARSED_USER="${BASH_REMATCH[1]}"
        PARSED_PASSWORD="${BASH_REMATCH[2]}"
        PARSED_HOST="${BASH_REMATCH[3]}"
        PARSED_PORT="${BASH_REMATCH[4]}"
        PARSED_DATABASE="${BASH_REMATCH[5]}"
        PARSED_AUTH_DB="admin"
        return 0
    fi

    return 1
}

# Função para ler credenciais do .env
load_env_file() {
    local env_file="$1"

    if [ ! -f "$env_file" ]; then
        echo -e "${RED}Erro: Arquivo .env não encontrado: $env_file${NC}"
        return 1
    fi

    echo -e "${BLUE}Lendo credenciais de: $env_file${NC}"

    local mongo_uri=$(grep -E "^MONGO_URI=" "$env_file" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

    if [ -n "$mongo_uri" ]; then
        if parse_mongo_uri "$mongo_uri"; then
            echo -e "${GREEN}✓ MONGO_URI parseado com sucesso${NC}"
            return 0
        fi
    fi

    echo -e "${RED}Erro: Não foi possível parsear MONGO_URI${NC}"
    return 1
}

# Função para detectar container MongoDB
detect_mongo_container() {
    docker ps --format '{{.Names}}' 2>/dev/null | grep -i mongo | head -1
}

# Variáveis
ENV_FILE="$DEFAULT_ENV_FILE"
DOCKER_CONTAINER=""
DRY_RUN=false
USER_EMAIL=""

# Parse argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV_FILE="$2"
            shift 2
            ;;
        -c|--container)
            DOCKER_CONTAINER="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        -*)
            echo -e "${RED}Opção desconhecida: $1${NC}"
            show_help
            exit 1
            ;;
        *)
            USER_EMAIL="$1"
            shift
            ;;
    esac
done

# Validar email
if [ -z "$USER_EMAIL" ]; then
    echo -e "${RED}Erro: Email do usuário não informado${NC}"
    show_help
    exit 1
fi

# Carregar credenciais
if ! load_env_file "$ENV_FILE"; then
    exit 1
fi

# Detectar container
if [ -z "$DOCKER_CONTAINER" ]; then
    DOCKER_CONTAINER=$(detect_mongo_container)
fi

if [ -z "$DOCKER_CONTAINER" ]; then
    echo -e "${RED}Erro: Nenhum container MongoDB encontrado${NC}"
    echo -e "${YELLOW}Use --container para especificar manualmente${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}=== MockMail.dev - Reset de Senha ===${NC}"
echo ""
echo -e "${YELLOW}Configurações:${NC}"
echo "  Container:  $DOCKER_CONTAINER"
echo "  Database:   $PARSED_DATABASE"
echo "  Auth DB:    $PARSED_AUTH_DB"
echo "  Usuário DB: $PARSED_USER"
echo "  Email:      $USER_EMAIL"
echo "  Nova senha: $DEFAULT_PASSWORD"
echo "  Dry run:    $DRY_RUN"
echo ""

# Criar arquivo temporário com o comando MongoDB (evita problemas de escape)
MONGO_SCRIPT=$(mktemp)
cat > "$MONGO_SCRIPT" << 'MONGOEOF'
db.users.updateOne(
  { email: "USER_EMAIL_PLACEHOLDER" },
  { $set: { password: "HASH_PLACEHOLDER" } }
)
MONGOEOF

# Substituir placeholders
sed -i "s|USER_EMAIL_PLACEHOLDER|$USER_EMAIL|g" "$MONGO_SCRIPT"
sed -i "s|HASH_PLACEHOLDER|$DEFAULT_HASH|g" "$MONGO_SCRIPT"

MONGO_CMD="mongosh -u $PARSED_USER -p $PARSED_PASSWORD --authenticationDatabase $PARSED_AUTH_DB $PARSED_DATABASE --quiet --file /tmp/reset-script.js"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN] Comando que seria executado:${NC}"
    echo "Conteúdo do script:"
    cat "$MONGO_SCRIPT"
    echo ""
    rm -f "$MONGO_SCRIPT"
else
    echo -e "${BLUE}Atualizando senha...${NC}"

    # Copiar script para dentro do container
    if ! docker cp "$MONGO_SCRIPT" "$DOCKER_CONTAINER":/tmp/reset-script.js; then
        echo -e "${RED}Erro ao copiar script para o container${NC}"
        rm -f "$MONGO_SCRIPT"
        exit 1
    fi
    rm -f "$MONGO_SCRIPT"

    # Debug: mostrar conteúdo do script no container
    echo -e "${YELLOW}Executando comando no MongoDB...${NC}"
    
    RESULT=$(docker exec "$DOCKER_CONTAINER" mongosh \
        -u "$PARSED_USER" \
        -p "$PARSED_PASSWORD" \
        --authenticationDatabase "$PARSED_AUTH_DB" \
        "$PARSED_DATABASE" \
        --quiet \
        --file /tmp/reset-script.js 2>&1)
    
    # Limpar script do container
    docker exec "$DOCKER_CONTAINER" rm -f /tmp/reset-script.js 2>/dev/null || true
    
    # Debug: mostrar resultado
    echo -e "${YELLOW}Resultado: $RESULT${NC}"

    if echo "$RESULT" | grep -q "matchedCount: 1"; then
        if echo "$RESULT" | grep -q "modifiedCount: 1"; then
            echo -e "${GREEN}✓ Senha atualizada com sucesso!${NC}"
        else
            echo -e "${YELLOW}⚠ Usuário encontrado, mas senha já era a mesma${NC}"
        fi
        echo ""
        echo -e "${GREEN}Credenciais de acesso:${NC}"
        echo -e "  Email: ${BLUE}$USER_EMAIL${NC}"
        echo -e "  Senha: ${BLUE}$DEFAULT_PASSWORD${NC}"
    elif echo "$RESULT" | grep -q "matchedCount: 0"; then
        echo -e "${RED}✗ Usuário não encontrado: $USER_EMAIL${NC}"
        exit 1
    else
        echo -e "${RED}Erro ao atualizar senha:${NC}"
        echo "$RESULT"
        exit 1
    fi
fi

echo ""
