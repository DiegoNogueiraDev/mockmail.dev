#!/bin/bash
# Script de Hardening de Segurança

echo "=== Iniciando hardening de segurança ==="

# 1. Atualizar sistema
echo "[1/8] Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# 2. Instalar ferramentas de segurança
echo "[2/8] Instalando ferramentas de segurança..."
sudo apt install -y fail2ban ufw rkhunter chkrootkit aide

# 3. Configurar firewall
echo "[3/8] Configurando firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 4. Configurar fail2ban (proteção contra brute force)
echo "[4/8] Configurando fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 5. Desabilitar execução em /tmp e /var/tmp
echo "[5/8] Protegendo diretórios temporários..."
sudo mount -o remount,noexec,nosuid,nodev /tmp 2>/dev/null || echo "/tmp já protegido ou requer configuração no fstab"
sudo mount -o remount,noexec,nosuid,nodev /var/tmp 2>/dev/null || echo "/var/tmp já protegido ou requer configuração no fstab"

# 6. Adicionar proteção permanente no fstab
if ! grep -q "tmpfs.*noexec" /etc/fstab; then
    echo "tmpfs /tmp tmpfs defaults,noexec,nosuid,nodev,mode=1777 0 0" | sudo tee -a /etc/fstab
    echo "tmpfs /var/tmp tmpfs defaults,noexec,nosuid,nodev,mode=1777 0 0" | sudo tee -a /etc/fstab
fi

# 7. Configurar monitoramento de integridade
echo "[6/8] Inicializando AIDE (pode demorar)..."
sudo aideinit 2>/dev/null || echo "Execute 'sudo aideinit' manualmente depois"

# 8. Criar script de monitoramento
echo "[7/8] Criando script de monitoramento..."
cat > ~/check-suspicious-processes.sh << 'MONITOR'
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
MONITOR

chmod +x ~/check-suspicious-processes.sh

# 9. Configurar auditoria de SSH
echo "[8/8] Configurando auditoria SSH..."
echo "PermitRootLogin no" | sudo tee -a /etc/ssh/sshd_config.d/hardening.conf
echo "PasswordAuthentication no" | sudo tee -a /etc/ssh/sshd_config.d/hardening.conf 2>/dev/null || echo "Use chaves SSH quando possível"

echo ""
echo "=== Hardening completo! ==="
echo ""
echo "Próximos passos importantes:"
echo "1. Execute: ~/check-suspicious-processes.sh (diariamente)"
echo "2. Revise chaves SSH autorizadas: cat ~/.ssh/authorized_keys"
echo "3. Verifique rootkits: sudo rkhunter --check"
echo "4. Monitore logs: sudo journalctl -f"
echo "5. Troque TODAS as senhas do sistema"
