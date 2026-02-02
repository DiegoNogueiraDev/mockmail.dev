# 🛡️ Guia Completo de Segurança - MockMail.dev Server

> Documento criado após incidente de segurança em 01/02/2026
> Servidor: Ubuntu 24.04 LTS - 158.220.106.48

---

## 📋 Índice

1. [Resumo do Incidente](#1-resumo-do-incidente)
2. [SSH Hardening](#2-ssh-hardening)
3. [Firewall (UFW + iptables)](#3-firewall-ufw--iptables)
4. [Fail2ban](#4-fail2ban)
5. [Atualizações Automáticas](#5-atualizações-automáticas)
6. [Monitoramento e Auditoria](#6-monitoramento-e-auditoria)
7. [Proteção de Usuários](#7-proteção-de-usuários)
8. [Proteção de Serviços](#8-proteção-de-serviços)
9. [Backups](#9-backups)
10. [Checklist de Verificação Periódica](#10-checklist-de-verificação-periódica)
11. [Resposta a Incidentes](#11-resposta-a-incidentes)
12. [Comandos Úteis de Emergência](#12-comandos-úteis-de-emergência)

---

## 1. Resumo do Incidente

### O que aconteceu
- **Data**: 01/02/2026
- **Vetor de ataque**: Login SSH com senha comprometida
- **IP atacante**: `167.86.117.12`
- **Método**: SFTP upload de malware + crontab para persistência
- **Malware**: Cryptominer em `/run/user/1000/.update`
- **Sintomas**: Travamentos frequentes, desconexões SSH

### Lições aprendidas
1. Senhas SSH são vulneráveis a brute-force e credential stuffing
2. Monitoramento de logins é essencial
3. Crontab pode ser usado para persistência de malware
4. Diretórios tmpfs (/run) são usados para esconder malware

---

## 2. SSH Hardening

### 2.1 Configuração do SSHD (`/etc/ssh/sshd_config`)

```bash
# Backup da configuração atual
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d)

# Editar configuração
sudo nano /etc/ssh/sshd_config
```

**Configurações recomendadas:**

```bash
# === AUTENTICAÇÃO ===
# CRÍTICO: Desabilitar login por senha
PasswordAuthentication no
ChallengeResponseAuthentication no
UsePAM yes

# Desabilitar login root
PermitRootLogin no

# Permitir apenas usuários específicos
AllowUsers anaopcd

# Autenticação por chave pública
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# === SEGURANÇA ===
# Limitar tentativas de autenticação
MaxAuthTries 3
MaxSessions 5

# Timeout de conexão
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2

# Desabilitar recursos não usados
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitTunnel no

# Usar apenas protocolo 2
Protocol 2

# Algoritmos seguros (remover fracos)
KexAlgorithms curve25519-sha256@libssh.org,diffie-hellman-group-exchange-sha256
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com

# === LOGGING ===
LogLevel VERBOSE
SyslogFacility AUTH

# === BANNER ===
Banner /etc/ssh/banner
```

**Aplicar configuração:**

```bash
# Testar configuração antes de aplicar
sudo sshd -t

# Se OK, reiniciar
sudo systemctl restart sshd
```

### 2.2 Criar Banner de Aviso (`/etc/ssh/banner`)

```bash
cat << 'EOF' | sudo tee /etc/ssh/banner
╔═══════════════════════════════════════════════════════════╗
║                      ACESSO RESTRITO                      ║
║                                                           ║
║  Este sistema é monitorado. Acesso não autorizado é      ║
║  proibido e será processado conforme a lei.              ║
║                                                           ║
║  Todas as atividades são registradas e auditadas.        ║
╚═══════════════════════════════════════════════════════════╝
EOF
```

### 2.3 Gerenciamento de Chaves SSH

```bash
# No computador LOCAL - Gerar nova chave forte
ssh-keygen -t ed25519 -a 100 -C "seu@email.com" -f ~/.ssh/servidor_mockmail

# Copiar para o servidor
ssh-copy-id -i ~/.ssh/servidor_mockmail.pub -p 2222 anaopcd@158.220.106.48

# Configurar alias no ~/.ssh/config local
cat << 'EOF' >> ~/.ssh/config
Host mockmail
    HostName 158.220.106.48
    Port 2222
    User anaopcd
    IdentityFile ~/.ssh/servidor_mockmail
    IdentitiesOnly yes
EOF

# Agora pode conectar com: ssh mockmail
```

### 2.4 Proteção das Chaves no Servidor

```bash
# Permissões corretas
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# Tornar imutável (ninguém pode modificar, nem root sem remover flag)
sudo chattr +i ~/.ssh/authorized_keys
# Para editar depois: sudo chattr -i ~/.ssh/authorized_keys
```

---

## 3. Firewall (UFW + iptables)

### 3.1 Configuração UFW

```bash
# Resetar para padrão
sudo ufw reset

# Política padrão: negar entrada, permitir saída
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (porta customizada)
sudo ufw allow 2222/tcp comment 'SSH'

# HTTP/HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Email (se necessário)
sudo ufw allow 25/tcp comment 'SMTP'
sudo ufw allow 587/tcp comment 'SMTP Submission'
sudo ufw allow 993/tcp comment 'IMAPS'
sudo ufw allow 995/tcp comment 'POP3S'

# Ativar
sudo ufw enable

# Verificar
sudo ufw status verbose
```

### 3.2 Bloquear IPs Maliciosos (iptables)

```bash
# Bloquear IP específico
sudo iptables -I INPUT -s 167.86.117.12 -j DROP

# Bloquear range de IPs (ataques frequentes)
sudo iptables -I INPUT -s 80.94.92.0/24 -j DROP
sudo iptables -I INPUT -s 45.148.10.0/24 -j DROP
sudo iptables -I INPUT -s 193.24.211.0/24 -j DROP
sudo iptables -I INPUT -s 138.68.155.0/24 -j DROP

# Salvar regras permanentemente
sudo sh -c 'iptables-save > /etc/iptables.rules'

# Criar script de restauração
cat << 'EOF' | sudo tee /etc/network/if-pre-up.d/iptables
#!/bin/sh
iptables-restore < /etc/iptables.rules
exit 0
EOF
sudo chmod +x /etc/network/if-pre-up.d/iptables
```

### 3.3 Rate Limiting (Proteção contra brute-force)

```bash
# Limitar conexões SSH (máx 3 por minuto por IP)
sudo iptables -A INPUT -p tcp --dport 2222 -m state --state NEW -m recent --set
sudo iptables -A INPUT -p tcp --dport 2222 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP

# Salvar
sudo sh -c 'iptables-save > /etc/iptables.rules'
```

---

## 4. Fail2ban

### 4.1 Configuração Principal (`/etc/fail2ban/jail.local`)

```bash
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
# Ignorar IPs confiáveis (SEU IP)
ignoreip = 127.0.0.1/8 ::1 201.21.152.228

# Tempo de ban (24 horas)
bantime = 86400

# Janela de tempo para contar falhas
findtime = 600

# Número de falhas antes do ban
maxretry = 3

# Ação de ban
banaction = iptables-multiport
banaction_allports = iptables-allports

# Notificação por email (opcional)
# destemail = seu@email.com
# sender = fail2ban@mockmail.dev
# action = %(action_mwl)s

[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400

[sshd-aggressive]
enabled = true
port = 2222
filter = sshd[mode=aggressive]
logpath = /var/log/auth.log
maxretry = 1
bantime = 604800

# Proteção para Postfix
[postfix]
enabled = true
port = smtp,465,submission
filter = postfix
logpath = /var/log/mail.log
maxretry = 5

# Proteção para Dovecot
[dovecot]
enabled = true
port = pop3,pop3s,imap,imaps
filter = dovecot
logpath = /var/log/mail.log
maxretry = 5

# Proteção para HAProxy
[haproxy-http-auth]
enabled = true
port = http,https
filter = haproxy-http-auth
logpath = /var/log/haproxy.log
maxretry = 5

# Ban recidivistas (quem foi banido antes)
[recidive]
enabled = true
logpath = /var/log/fail2ban.log
banaction = %(banaction_allports)s
bantime = 604800
findtime = 86400
maxretry = 3
```

### 4.2 Comandos Úteis

```bash
# Reiniciar fail2ban
sudo systemctl restart fail2ban

# Ver status
sudo fail2ban-client status
sudo fail2ban-client status sshd

# Ver IPs banidos
sudo fail2ban-client get sshd banned

# Desbanir IP específico
sudo fail2ban-client set sshd unbanip 1.2.3.4

# Ver logs
sudo tail -f /var/log/fail2ban.log
```

---

## 5. Atualizações Automáticas

### 5.1 Configurar Unattended Upgrades

```bash
sudo apt install unattended-upgrades apt-listchanges

# Configurar
sudo dpkg-reconfigure -plow unattended-upgrades
```

**Editar `/etc/apt/apt.conf.d/50unattended-upgrades`:**

```bash
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

// Reiniciar automaticamente se necessário (às 3h)
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";

// Notificação por email
Unattended-Upgrade::Mail "seu@email.com";
Unattended-Upgrade::MailReport "on-change";

// Remover pacotes não usados
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
```

### 5.2 Verificar Atualizações Manualmente

```bash
# Ver atualizações disponíveis
sudo apt update && apt list --upgradable

# Atualizar tudo
sudo apt upgrade -y

# Atualização completa (pode remover pacotes)
sudo apt full-upgrade -y

# Limpar
sudo apt autoremove -y
sudo apt autoclean
```

---

## 6. Monitoramento e Auditoria

### 6.1 Auditd (Auditoria do Sistema)

```bash
# Instalar
sudo apt install auditd audispd-plugins

# Configurar regras básicas
sudo nano /etc/audit/rules.d/audit.rules
```

```bash
# Monitorar alterações em arquivos críticos
-w /etc/passwd -p wa -k identity
-w /etc/group -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k sudoers
-w /etc/ssh/sshd_config -p wa -k sshd_config

# Monitorar crontabs
-w /etc/crontab -p wa -k cron
-w /etc/cron.d/ -p wa -k cron
-w /var/spool/cron/crontabs/ -p wa -k cron

# Monitorar comandos sudo
-a always,exit -F arch=b64 -S execve -F euid=0 -k rootcmd

# Monitorar alterações de hora
-a always,exit -F arch=b64 -S adjtimex -S settimeofday -k time-change
```

```bash
# Aplicar
sudo augenrules --load
sudo systemctl restart auditd
```

### 6.2 Logwatch (Relatórios Diários)

```bash
# Instalar
sudo apt install logwatch

# Testar
sudo logwatch --detail High --mailto seu@email.com --range today

# Configurar envio diário (já vem com cron.daily)
```

### 6.3 Monitorar Logins em Tempo Real

Criar script `/usr/local/bin/login-alert.sh`:

```bash
#!/bin/bash
# Envia alerta quando alguém faz login

if [ "$PAM_TYPE" = "open_session" ]; then
    IP=$(echo $SSH_CONNECTION | awk '{print $1}')
    MSG="Login SSH: $PAM_USER de $IP em $(hostname) - $(date)"

    # Log
    logger -t login-alert "$MSG"

    # Email (opcional - configure SMTP primeiro)
    # echo "$MSG" | mail -s "SSH Login Alert" seu@email.com
fi
```

```bash
sudo chmod +x /usr/local/bin/login-alert.sh

# Adicionar ao PAM
echo "session optional pam_exec.so /usr/local/bin/login-alert.sh" | sudo tee -a /etc/pam.d/sshd
```

### 6.4 Monitorar Processos com Alto Consumo

Criar script `/usr/local/bin/resource-monitor.sh`:

```bash
#!/bin/bash
# Alerta se CPU > 80%

THRESHOLD=80
LOG=/var/log/resource-monitor.log

CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | cut -d'.' -f1)

if [ "$CPU" -gt "$THRESHOLD" ]; then
    echo "$(date): ALERTA - CPU em ${CPU}%" >> $LOG
    echo "Processos mais pesados:" >> $LOG
    ps aux --sort=-%cpu | head -10 >> $LOG
fi
```

```bash
sudo chmod +x /usr/local/bin/resource-monitor.sh

# Adicionar ao cron (a cada 5 minutos)
echo "*/5 * * * * root /usr/local/bin/resource-monitor.sh" | sudo tee /etc/cron.d/resource-monitor
```

---

## 7. Proteção de Usuários

### 7.1 Política de Senhas

```bash
# Instalar módulo de qualidade de senha
sudo apt install libpam-pwquality

# Configurar
sudo nano /etc/security/pwquality.conf
```

```ini
# Mínimo 14 caracteres
minlen = 14
# Mínimo de classes de caracteres (maiúscula, minúscula, número, especial)
minclass = 3
# Máximo de caracteres repetidos
maxrepeat = 2
# Não permitir username na senha
usercheck = 1
# Verificar contra dicionário
dictcheck = 1
```

### 7.2 Limitar Acesso Sudo

```bash
# Editar sudoers com visudo
sudo visudo
```

```bash
# Timeout de senha sudo (15 minutos)
Defaults timestamp_timeout=15

# Log de comandos sudo
Defaults logfile="/var/log/sudo.log"
Defaults log_input, log_output

# Usuário específico com permissões limitadas (exemplo)
# anaopcd ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart pm2-anaopcd
```

### 7.3 Limitar Recursos por Usuário

```bash
sudo nano /etc/security/limits.conf
```

```bash
# Limites para todos os usuários
*               soft    nofile          65535
*               hard    nofile          65535
*               soft    nproc           4096
*               hard    nproc           4096

# Limites específicos
anaopcd         soft    nproc           2048
anaopcd         hard    nproc           4096
```

---

## 8. Proteção de Serviços

### 8.1 Docker Security

```yaml
# Em docker-compose.yml:

# Não rodar containers como root
user: "1000:1000"

# Limitar recursos
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M

# Rede isolada
networks:
  - internal
```

```bash
# Verificar vulnerabilidades
docker scan nome-da-imagem
```

### 8.2 MongoDB Security

```yaml
# /etc/mongod.conf - Bind apenas localhost
net:
  bindIp: 127.0.0.1

# Habilitar autenticação
security:
  authorization: enabled
```

### 8.3 Postfix Security

```bash
# /etc/postfix/main.cf

# Limitar tamanho de mensagem (25MB)
message_size_limit = 26214400

# Limitar taxa de conexão
smtpd_client_connection_rate_limit = 50
smtpd_client_message_rate_limit = 100

# HELO restrictions
smtpd_helo_required = yes
smtpd_helo_restrictions = permit_mynetworks, reject_invalid_helo_hostname
```

### 8.4 HAProxy Security Headers

```bash
# /etc/haproxy/haproxy.cfg

frontend https
    # Security Headers
    http-response set-header X-Frame-Options DENY
    http-response set-header X-Content-Type-Options nosniff
    http-response set-header X-XSS-Protection "1; mode=block"
    http-response set-header Referrer-Policy strict-origin-when-cross-origin

    # Remover headers que expõem informações
    http-response del-header Server
    http-response del-header X-Powered-By
```

---

## 9. Backups

### 9.1 Script de Backup Automático

Criar `/usr/local/bin/backup-mockmail.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/mockmail"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p $BACKUP_DIR

# Backup MongoDB
docker exec mockmail-mongodb mongodump --out /tmp/mongodump_$DATE
docker cp mockmail-mongodb:/tmp/mongodump_$DATE $BACKUP_DIR/mongodb_$DATE
docker exec mockmail-mongodb rm -rf /tmp/mongodump_$DATE

# Backup configs
tar -czf $BACKUP_DIR/configs_$DATE.tar.gz \
    /etc/ssh/sshd_config \
    /etc/fail2ban/jail.local \
    /etc/haproxy/haproxy.cfg \
    /etc/postfix/main.cf \
    /home/anaopcd/mockmail-producao/.env* \
    2>/dev/null

# Backup crontabs
cp /var/spool/cron/crontabs/anaopcd $BACKUP_DIR/crontab_anaopcd_$DATE 2>/dev/null

# Remover backups antigos
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -type d -empty -delete

# Log
echo "$(date): Backup concluído" >> /var/log/backup-mockmail.log
```

```bash
sudo chmod +x /usr/local/bin/backup-mockmail.sh

# Agendar backup diário às 4h
echo "0 4 * * * root /usr/local/bin/backup-mockmail.sh" | sudo tee /etc/cron.d/backup-mockmail
```

---

## 10. Checklist de Verificação Periódica

### 10.1 Semanal (Manual)

```bash
# Criar script de verificação
cat << 'SCRIPT' | sudo tee /usr/local/bin/security-check.sh
#!/bin/bash

echo "=========================================="
echo "VERIFICAÇÃO DE SEGURANÇA"
echo "Data: $(date)"
echo "=========================================="

echo -e "\n[1] Últimos logins:"
last -20

echo -e "\n[2] Logins SSH aceitos (últimos 7 dias):"
sudo grep "Accepted" /var/log/auth.log | tail -20

echo -e "\n[3] IPs banidos pelo fail2ban:"
sudo fail2ban-client status sshd

echo -e "\n[4] Crontab do usuário:"
crontab -l

echo -e "\n[5] Processos com alto consumo:"
ps aux --sort=-%cpu | head -10

echo -e "\n[6] Uso de disco:"
df -h

echo -e "\n[7] Atualizações pendentes:"
apt list --upgradable 2>/dev/null

echo -e "\n[8] Portas abertas:"
ss -tulpn | grep LISTEN

echo -e "\n[9] Verificação de rootkit:"
sudo chkrootkit 2>/dev/null | grep -E "INFECTED|Warning"

echo -e "\n=========================================="
SCRIPT

sudo chmod +x /usr/local/bin/security-check.sh
```

### 10.2 Mensal

```bash
# Rodar verificação completa de rootkit
sudo rkhunter --check --skip-keypress

# Revisar usuários
cat /etc/passwd | grep -v nologin | grep -v false

# Verificar permissões
ls -la /etc/shadow /etc/passwd /etc/sudoers

# Revisar chaves SSH
cat ~/.ssh/authorized_keys
```

---

## 11. Resposta a Incidentes

### 11.1 Se Suspeitar de Comprometimento

```bash
# 1. NÃO DESLIGUE O SERVIDOR (preserva evidências na RAM)

# 2. Documente tudo
script /tmp/incident_$(date +%Y%m%d_%H%M%S).log

# 3. Capture estado atual
ps auxf > /tmp/processes.txt
netstat -tulpn > /tmp/connections.txt
last -100 > /tmp/logins.txt

# 4. Verifique crontabs
crontab -l > /tmp/crontab_user.txt
sudo cat /etc/crontab > /tmp/crontab_system.txt

# 5. Verifique arquivos modificados recentemente
find /etc -type f -mtime -1 > /tmp/etc_modified.txt
find /home -type f -mtime -1 > /tmp/home_modified.txt
```

### 11.2 Isolamento Rápido

```bash
# Bloquear todo tráfego exceto seu IP
sudo iptables -I INPUT -s SEU_IP -j ACCEPT
sudo iptables -I INPUT -j DROP
sudo iptables -I OUTPUT -j DROP
sudo iptables -I OUTPUT -d SEU_IP -j ACCEPT
```

---

## 12. Comandos Úteis de Emergência

### Investigação Rápida

```bash
# Quem está logado agora
w
who

# Últimos logins
last -20

# Logins SSH falhos/aceitos
sudo grep "Failed\|Accepted" /var/log/auth.log | tail -30

# Conexões de rede ativas
ss -tulpn

# Processos por CPU
ps aux --sort=-%cpu | head -20

# Crontabs
crontab -l && sudo cat /etc/crontab && sudo ls -la /etc/cron.d/
```

### Bloquear Acesso Imediato

```bash
# Bloquear IP
sudo iptables -I INPUT -s IP_MALICIOSO -j DROP

# Matar sessão de usuário
pkill -u usuario

# Desabilitar usuário
sudo usermod -L usuario
```

### Verificação de Integridade

```bash
# Scan rápido de rootkit
sudo chkrootkit -q

# Scan completo
sudo rkhunter --check

# Verificar pacotes modificados
dpkg --verify
```

---

## 📝 Status Atual do Servidor

### ✅ Configurações Aplicadas (01/02/2026)
- SSH apenas por chave (PasswordAuthentication no)
- SSH em porta 2222
- fail2ban ativo
- IP atacante bloqueado (167.86.117.12)
- Senha trocada
- Crontab limpo

### ⏳ Recomendado Implementar
- [ ] Configurar alertas por email
- [ ] Configurar backup offsite
- [ ] Bloquear ranges de IPs atacantes frequentes
- [ ] Implementar rate limiting no iptables
- [ ] Configurar auditd para monitorar crontabs

---

**Última atualização**: 01/02/2026
**Autor**: Diego Nogueira / Claude Code
