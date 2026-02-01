#!/bin/bash

# =============================================================================
# Script de Importação de Backup MongoDB para Servidor Remoto
# MockMail.dev
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações padrão
BACKUP_FILE="mongodb-backup-20260131-170957.gz"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Função de ajuda
show_help() {
    echo ""
    echo -e "${BLUE}=== MockMail.dev - Importação de Backup MongoDB ===${NC}"
    echo ""
    echo "Uso: $0 [opções]"
    echo ""
    echo "Opções:"
    echo "  -h, --host        Host do MongoDB remoto (obrigatório)"
    echo "  -p, --port        Porta do MongoDB (padrão: 27017)"
    echo "  -u, --user        Usuário do MongoDB"
    echo "  -P, --password    Senha do MongoDB"
    echo "  -d, --database    Nome do banco de dados (padrão: mockmail)"
    echo "  -a, --authdb      Banco de autenticação (padrão: admin)"
    echo "  -f, --file        Arquivo de backup (padrão: $BACKUP_FILE)"
    echo "  --drop            Dropar coleções existentes antes de importar"
    echo "  --dry-run         Apenas simular, não executar"
    echo "  --help            Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 -h servidor.com -u admin -P senha123"
    echo "  $0 -h 192.168.1.100 -p 27017 -u admin -P senha --drop"
    echo "  $0 -h mongo.exemplo.com -u admin -P senha -d mockmail_prod"
    echo ""
}

# Variáveis
MONGO_HOST=""
MONGO_PORT="27017"
MONGO_USER=""
MONGO_PASSWORD=""
MONGO_DATABASE="mockmail"
MONGO_AUTH_DB="admin"
DROP_COLLECTIONS=""
DRY_RUN=false

# Parse argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            MONGO_HOST="$2"
            shift 2
            ;;
        -p|--port)
            MONGO_PORT="$2"
            shift 2
            ;;
        -u|--user)
            MONGO_USER="$2"
            shift 2
            ;;
        -P|--password)
            MONGO_PASSWORD="$2"
            shift 2
            ;;
        -d|--database)
            MONGO_DATABASE="$2"
            shift 2
            ;;
        -a|--authdb)
            MONGO_AUTH_DB="$2"
            shift 2
            ;;
        -f|--file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --drop)
            DROP_COLLECTIONS="--drop"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Opção desconhecida: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Validações
if [ -z "$MONGO_HOST" ]; then
    echo -e "${RED}Erro: Host do MongoDB é obrigatório${NC}"
    show_help
    exit 1
fi

# Verificar se o arquivo de backup existe
BACKUP_PATH="$SCRIPT_DIR/$BACKUP_FILE"
if [ ! -f "$BACKUP_PATH" ]; then
    echo -e "${RED}Erro: Arquivo de backup não encontrado: $BACKUP_PATH${NC}"
    exit 1
fi

# Verificar se mongorestore está instalado
if ! command -v mongorestore &> /dev/null; then
    echo -e "${RED}Erro: mongorestore não está instalado${NC}"
    echo -e "${YELLOW}Instale com: sudo apt-get install mongodb-database-tools${NC}"
    exit 1
fi

# Montar string de conexão
if [ -n "$MONGO_USER" ] && [ -n "$MONGO_PASSWORD" ]; then
    # Com autenticação
    MONGO_URI="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}?authSource=${MONGO_AUTH_DB}"
    AUTH_ARGS="--username $MONGO_USER --password $MONGO_PASSWORD --authenticationDatabase $MONGO_AUTH_DB"
else
    # Sem autenticação
    MONGO_URI="mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}"
    AUTH_ARGS=""
fi

echo ""
echo -e "${BLUE}=== MockMail.dev - Importação de Backup MongoDB ===${NC}"
echo ""
echo -e "${YELLOW}Configurações:${NC}"
echo "  Host:        $MONGO_HOST:$MONGO_PORT"
echo "  Database:    $MONGO_DATABASE"
echo "  Auth DB:     $MONGO_AUTH_DB"
echo "  Usuário:     ${MONGO_USER:-'(sem autenticação)'}"
echo "  Arquivo:     $BACKUP_FILE"
echo "  Drop antes:  ${DROP_COLLECTIONS:-'Não'}"
echo "  Dry run:     $DRY_RUN"
echo ""

# Criar diretório temporário para extração
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${BLUE}[1/4] Extraindo backup...${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN] gunzip -c $BACKUP_PATH > $TEMP_DIR/backup.archive${NC}"
else
    gunzip -c "$BACKUP_PATH" > "$TEMP_DIR/backup.archive"
    echo -e "${GREEN}Backup extraído com sucesso${NC}"
fi

echo ""
echo -e "${BLUE}[2/4] Testando conexão com MongoDB...${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN] mongosh --host $MONGO_HOST --port $MONGO_PORT $AUTH_ARGS --eval 'db.runCommand({ping:1})'${NC}"
else
    # Testar conexão
    if command -v mongosh &> /dev/null; then
        PING_CMD="mongosh --host $MONGO_HOST --port $MONGO_PORT"
        if [ -n "$MONGO_USER" ]; then
            PING_CMD="$PING_CMD --username $MONGO_USER --password $MONGO_PASSWORD --authenticationDatabase $MONGO_AUTH_DB"
        fi
        PING_CMD="$PING_CMD --eval 'db.runCommand({ping:1})' --quiet"
        
        if eval "$PING_CMD" &>/dev/null; then
            echo -e "${GREEN}Conexão estabelecida com sucesso${NC}"
        else
            echo -e "${RED}Erro: Não foi possível conectar ao MongoDB${NC}"
            echo -e "${YELLOW}Verifique as credenciais e se o servidor está acessível${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}mongosh não encontrado, pulando teste de conexão...${NC}"
    fi
fi

echo ""
echo -e "${BLUE}[3/4] Importando backup para o MongoDB...${NC}"

# Montar comando mongorestore
RESTORE_CMD="mongorestore --host $MONGO_HOST --port $MONGO_PORT"
if [ -n "$MONGO_USER" ]; then
    RESTORE_CMD="$RESTORE_CMD --username $MONGO_USER --password $MONGO_PASSWORD --authenticationDatabase $MONGO_AUTH_DB"
fi
RESTORE_CMD="$RESTORE_CMD --archive=$TEMP_DIR/backup.archive --gzip=false --nsInclude='mockmail.*' --nsFrom='mockmail.*' --nsTo='${MONGO_DATABASE}.*'"
if [ -n "$DROP_COLLECTIONS" ]; then
    RESTORE_CMD="$RESTORE_CMD --drop"
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN] $RESTORE_CMD${NC}"
else
    echo -e "${YELLOW}Executando: mongorestore...${NC}"
    eval "$RESTORE_CMD"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Backup importado com sucesso!${NC}"
    else
        echo -e "${RED}Erro durante a importação${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}[4/4] Verificando importação...${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN] Verificando coleções importadas...${NC}"
else
    if command -v mongosh &> /dev/null; then
        VERIFY_CMD="mongosh --host $MONGO_HOST --port $MONGO_PORT"
        if [ -n "$MONGO_USER" ]; then
            VERIFY_CMD="$VERIFY_CMD --username $MONGO_USER --password $MONGO_PASSWORD --authenticationDatabase $MONGO_AUTH_DB"
        fi
        VERIFY_CMD="$VERIFY_CMD $MONGO_DATABASE --eval 'db.getCollectionNames().forEach(function(c) { print(c + \": \" + db[c].countDocuments() + \" documentos\"); })' --quiet"
        
        echo -e "${YELLOW}Coleções importadas:${NC}"
        eval "$VERIFY_CMD"
    fi
fi

echo ""
echo -e "${GREEN}=== Importação concluída com sucesso! ===${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "  1. Verifique se a aplicação está apontando para o banco correto"
echo "  2. Atualize o arquivo .env com as credenciais do servidor"
echo "  3. Reinicie os serviços da aplicação"
echo ""
