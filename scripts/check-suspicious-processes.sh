#!/bin/bash
# Verifica processos suspeitos de mineração

SUSPICIOUS_PATTERNS="xmrig|stratum|minerd|cpuminer|cryptonight|monero|nicehash"

ps aux | grep -iE "$SUSPICIOUS_PATTERNS" | grep -v grep | while read line; do
    PID=$(echo $line | awk '{print $2}')
    CMD=$(echo $line | awk '{print $11}')
    echo "[ALERTA] Processo suspeito detectado: PID $PID - $CMD"
    echo "Para eliminar: sudo kill -9 $PID"
done

# Verifica cron jobs suspeitos
crontab -l 2>/dev/null | grep -iE "base64|curl.*sh|wget.*sh" && echo "[ALERTA] Cron job suspeito encontrado"

# Verifica arquivos executáveis recentes em /tmp
find /tmp /var/tmp -type f -executable -mtime -7 2>/dev/null | while read file; do
    echo "[INFO] Executável recente: $file"
done
