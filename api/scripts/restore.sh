#!/bin/bash

###############################################################################
# Script de Restore do MockMail
# Descrição: Restaura backup do MongoDB e configurações
# Uso: ./restore.sh <arquivo_backup.tar.gz>
###############################################################################

set -e

# Configurações
BACKUP_BASE_DIR="/opt/mockmail-backups"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar argumento
if [ -z "$1" ]; then
    log_error "Uso: $0 <arquivo_backup.tar.gz>"
    echo ""
    echo "Backups disponíveis:"
    ls -lh "$BACKUP_BASE_DIR"/*.tar.gz 2>/dev/null || echo "Nenhum backup encontrado"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Arquivo não encontrado: $BACKUP_FILE"
    exit 1
fi

echo "=== Restauração do MockMail ==="
echo "Backup: $BACKUP_FILE"
log_warning "Esta operação irá sobrescrever os dados atuais!"
read -p "Deseja continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restauração cancelada"
    exit 0
fi

# Extrair backup
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
BACKUP_DIR=$(ls -d "$TEMP_DIR"/*/ | head -n 1)

log_success "Backup extraído em: $BACKUP_DIR"

# Restaurar MongoDB
echo "[1/2] Restaurando MongoDB..."
MONGO_USER="app_user"
MONGO_PASS="gVYy53hBuC55"
MONGO_HOST="localhost"
MONGO_PORT="27017"
MONGO_DB="mockmail"

if [ -d "${BACKUP_DIR}mongodb/$MONGO_DB" ]; then
    mongorestore \
        --host="$MONGO_HOST" \
        --port="$MONGO_PORT" \
        --username="$MONGO_USER" \
        --password="$MONGO_PASS" \
        --db="$MONGO_DB" \
        --authenticationDatabase="$MONGO_DB" \
        --gzip \
        --drop \
        "${BACKUP_DIR}mongodb/$MONGO_DB"
    log_success "MongoDB restaurado"
else
    log_error "Dados do MongoDB não encontrados no backup"
fi

# Restaurar configurações (opcional)
echo "[2/2] Configurações disponíveis no backup:"
ls -la "${BACKUP_DIR}configs/" 2>/dev/null || echo "Nenhuma configuração encontrada"

# Limpeza
rm -rf "$TEMP_DIR"
log_success "Restauração concluída!"

exit 0
