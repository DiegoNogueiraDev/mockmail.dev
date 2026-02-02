#!/bin/bash

###############################################################################
# Script de Backup Automático do MockMail
# Descrição: Realiza backup do MongoDB e configurações críticas
# Autor: System
# Data: 30/12/2025
###############################################################################

set -e

# Configurações
BACKUP_BASE_DIR="/opt/mockmail-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"
RETENTION_DAYS=7
LOG_FILE="${BACKUP_BASE_DIR}/backup.log"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"
mkdir -p "${BACKUP_BASE_DIR}/logs"

log "=== Iniciando Backup do MockMail ==="

# 1. Backup do MongoDB
log "[1/4] Realizando backup do MongoDB..."
MONGO_USER="app_user"
MONGO_PASS="gVYy53hBuC55"
MONGO_HOST="localhost"
MONGO_PORT="27017"
MONGO_DB="mockmail"

if mongodump \
    --host="${MONGO_HOST}" \
    --port="${MONGO_PORT}" \
    --username="${MONGO_USER}" \
    --password="${MONGO_PASS}" \
    --db="${MONGO_DB}" \
    --authenticationDatabase="${MONGO_DB}" \
    --out="${BACKUP_DIR}/mongodb" \
    --gzip 2>>"$LOG_FILE"; then
    log_success "Backup do MongoDB concluído"
else
    log_error "Falha no backup do MongoDB"
    exit 1
fi

# 2. Backup das configurações
log "[2/4] Realizando backup das configurações..."
CONFIG_DIR="${BACKUP_DIR}/configs"
mkdir -p "$CONFIG_DIR"

# Backup do .env (sem senhas no log)
if [ -f "/opt/mockmail-api/.env" ]; then
    cp /opt/mockmail-api/.env "$CONFIG_DIR/mockmail-api.env"
    log_success "Backup do .env da API realizado"
fi

# Backup do HAProxy
if [ -f "/etc/haproxy/haproxy.cfg" ]; then
    sudo cp /etc/haproxy/haproxy.cfg "$CONFIG_DIR/haproxy.cfg"
    log_success "Backup do HAProxy realizado"
fi

# Backup dos certificados SSL (apenas metadados, não os certificados)
if [ -d "/etc/ssl/haproxy" ]; then
    ls -la /etc/ssl/haproxy > "$CONFIG_DIR/ssl_certificates_list.txt"
    log_success "Lista de certificados SSL salva"
fi

# Backup do PM2 ecosystem
pm2 save --force 2>>"$LOG_FILE"
if [ -f "$HOME/.pm2/dump.pm2" ]; then
    cp "$HOME/.pm2/dump.pm2" "$CONFIG_DIR/pm2_dump.pm2"
    log_success "Backup do PM2 ecosystem realizado"
fi

# 3. Backup do código-fonte (apenas se houver mudanças)
log "[3/4] Verificando código-fonte..."
if [ -d "/opt/mockmail-api/.git" ]; then
    cd /opt/mockmail-api
    GIT_STATUS=$(git status --porcelain)
    if [ -n "$GIT_STATUS" ]; then
        log_warning "Há mudanças não comitadas no código"
        git diff > "$CONFIG_DIR/uncommitted_changes.diff"
    fi
    git log -1 > "$CONFIG_DIR/last_commit.txt"
    log_success "Status do código-fonte salvo"
fi

# 4. Compactar backup
log "[4/4] Compactando backup..."
cd "$BACKUP_BASE_DIR"
if tar -czf "${TIMESTAMP}.tar.gz" "${TIMESTAMP}" 2>>"$LOG_FILE"; then
    BACKUP_SIZE=$(du -h "${TIMESTAMP}.tar.gz" | cut -f1)
    log_success "Backup compactado: ${TIMESTAMP}.tar.gz (${BACKUP_SIZE})"
    
    # Remove diretório não compactado
    rm -rf "${BACKUP_DIR}"
else
    log_error "Falha ao compactar backup"
    exit 1
fi

# 5. Limpeza de backups antigos
log "Removendo backups com mais de ${RETENTION_DAYS} dias..."
find "$BACKUP_BASE_DIR" -name "*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
REMOVED_COUNT=$(find "$BACKUP_BASE_DIR" -name "*.tar.gz" -type f -mtime +${RETENTION_DAYS} | wc -l)
log_success "Limpeza concluída (${REMOVED_COUNT} backups antigos removidos)"

# 6. Relatório final
log "=== Backup Concluído com Sucesso ==="
log "Localização: ${BACKUP_BASE_DIR}/${TIMESTAMP}.tar.gz"
log "Tamanho: ${BACKUP_SIZE}"
log "Retenção: ${RETENTION_DAYS} dias"

# Listar backups disponíveis
log ""
log "Backups disponíveis:"
ls -lh "$BACKUP_BASE_DIR"/*.tar.gz 2>/dev/null | awk '{print $9, "-", $5}' | tee -a "$LOG_FILE"

exit 0
