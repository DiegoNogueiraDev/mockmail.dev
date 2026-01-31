#!/bin/bash
# Hardening Avançado do Servidor

echo "═══════════════════════════════════════════════════════════"
echo "  HARDENING AVANÇADO - Proteções Adicionais"
echo "═══════════════════════════════════════════════════════════"

# 1. Configurar fail2ban para SSH com regras mais rígidas
echo "[1/12] Configurando fail2ban para SSH..."
sudo bash -c 'cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
destemail = root@localhost
sendername = Fail2Ban
action = %(action_mwl)s

[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
findtime = 600
EOF'
sudo systemctl restart fail2ban

# 2. Bloquear portas desnecessárias
echo "[2/12] Bloqueando serviços expostos desnecessariamente..."
# Porta 8080 do Python http.server parece suspeita
sudo ufw deny 8080/tcp
sudo ufw deny 3000/tcp  # Node.js apps - bloqueie se não precisar externo
sudo ufw deny 3001/tcp

# 3. Limitar taxa de conexões SSH
echo "[3/12] Configurando rate limiting no SSH..."
sudo ufw limit 2222/tcp comment 'SSH rate limit'

# 4. Instalar e configurar auditd
echo "[4/12] Instalando auditd (monitoramento de comandos)..."
sudo apt install -y auditd audispd-plugins 2>/dev/null

# 5. Adicionar regras de auditoria
echo "[5/12] Configurando auditoria de arquivos críticos..."
sudo auditctl -w /etc/passwd -p wa -k passwd_changes
sudo auditctl -w /etc/shadow -p wa -k shadow_changes
sudo auditctl -w /etc/sudoers -p wa -k sudoers_changes
sudo auditctl -w /home/anaopcd/.ssh/ -p wa -k ssh_changes
sudo auditctl -w /home/anaopcd/.bashrc -p wa -k bashrc_changes
sudo auditctl -w /etc/crontab -p wa -k cron_changes

# 6. Desabilitar serviços HTTP desnecessários
echo "[6/12] Investigando serviço HTTP suspeito na porta 8080..."
PID_8080=$(sudo lsof -ti:8080)
if [ ! -z "$PID_8080" ]; then
    echo "  ⚠ Serviço Python HTTP rodando na porta 8080 (PID $PID_8080)"
    echo "  Execute: sudo kill $PID_8080 (se não for necessário)"
fi

# 7. Configurar limites de recursos
echo "[7/12] Configurando limites de recursos..."
sudo bash -c 'cat >> /etc/security/limits.conf << EOF
# Limites contra fork bombs e consumo excessivo
* soft nofile 65536
* hard nofile 65536
* soft nproc 4096
* hard nproc 4096
EOF'

# 8. Ativar proteções do kernel
echo "[8/12] Ativando proteções do kernel..."
sudo bash -c 'cat >> /etc/sysctl.conf << EOF

# Proteções de segurança
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.tcp_syncookies = 1
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
fs.suid_dumpable = 0
EOF'
sudo sysctl -p

# 9. Proteger Docker
echo "[9/12] Protegendo Docker..."
sudo bash -c 'cat > /etc/docker/daemon.json << EOF
{
  "icc": false,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "userland-proxy": false
}
EOF'
sudo systemctl restart docker 2>/dev/null || echo "Docker não reiniciado"

# 10. Configurar log rotation
echo "[10/12] Configurando rotação de logs de segurança..."
sudo bash -c 'cat > /etc/logrotate.d/security-logs << EOF
/home/anaopcd/security-check.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
}
EOF'

# 11. Criar script de alerta
echo "[11/12] Criando script de alerta de alta CPU..."
cat > ~/cpu-alert.sh << 'EOFCPU'
#!/bin/bash
CPU_THRESHOLD=80
CURRENT_CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | cut -d'.' -f1)

if [ $CURRENT_CPU -gt $CPU_THRESHOLD ]; then
    echo "[ALERTA] CPU em ${CURRENT_CPU}% às $(date)" >> ~/security-alerts.log
    ps aux --sort=-%cpu | head -10 >> ~/security-alerts.log
    echo "---" >> ~/security-alerts.log
fi
EOFCPU
chmod +x ~/cpu-alert.sh

# Adicionar ao cron
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/cpu-alert.sh") | crontab -

# 12. Criar backup das configurações de segurança
echo "[12/12] Criando backup de configurações..."
mkdir -p ~/security-backups
cp ~/.ssh/authorized_keys ~/security-backups/authorized_keys.backup
cp ~/.bashrc ~/security-backups/bashrc.backup
cp ~/.profile ~/security-backups/profile.backup
crontab -l > ~/security-backups/crontab.backup

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  HARDENING AVANÇADO CONCLUÍDO!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Novas proteções ativas:"
echo "  ✓ Fail2ban com regras mais rígidas"
echo "  ✓ Portas 8080, 3000, 3001 bloqueadas"
echo "  ✓ Rate limiting no SSH"
echo "  ✓ Auditd monitorando arquivos críticos"
echo "  ✓ Proteções de kernel ativadas"
echo "  ✓ Docker endurecido"
echo "  ✓ Alertas de CPU configurados"
echo "  ✓ Backups de segurança criados"
