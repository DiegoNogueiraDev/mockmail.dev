#!/bin/bash
#===============================================================================
# SCRIPT DE INVESTIGAÇÃO DE SEGURANÇA - MockMail.dev
# Execute como root no servidor: sudo bash investigar-servidor.sh
#===============================================================================

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

REPORT_DIR="/tmp/security-report-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   INVESTIGAÇÃO DE SEGURANÇA - MockMail.dev${NC}"
echo -e "${CYAN}   Relatório: $REPORT_DIR${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

#-------------------------------------------------------------------------------
# 1. PROCESSOS SUSPEITOS
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[1/12] PROCESSOS SUSPEITOS...${NC}"

echo "=== TOP PROCESSOS POR CPU ===" > "$REPORT_DIR/01-processos.txt"
ps aux --sort=-%cpu | head -20 >> "$REPORT_DIR/01-processos.txt"

echo -e "\n=== TOP PROCESSOS POR MEMÓRIA ===" >> "$REPORT_DIR/01-processos.txt"
ps aux --sort=-%mem | head -20 >> "$REPORT_DIR/01-processos.txt"

echo -e "\n=== PROCESSOS COM NOMES SUSPEITOS ===" >> "$REPORT_DIR/01-processos.txt"
ps aux | grep -iE '(kworker.*[0-9]{5}|xmr|mine|crypto|kdevtmpfsi|kinsing|solr|jenkins\.|ld-linux|\.hidden|/tmp/\.|/dev/shm)' | grep -v grep >> "$REPORT_DIR/01-processos.txt" 2>/dev/null

echo -e "\n=== PROCESSOS SEM TTY (possíveis backdoors) ===" >> "$REPORT_DIR/01-processos.txt"
ps aux | awk '$7 == "?" {print}' | grep -v -E '(systemd|sshd|cron|docker|postfix|nginx|node|python|pm2|mongod|redis)' >> "$REPORT_DIR/01-processos.txt"

# Contar suspeitos
SUSPEITOS=$(grep -c -iE '(xmr|mine|crypto|kdevtmpfsi|kinsing)' "$REPORT_DIR/01-processos.txt" 2>/dev/null || echo 0)
if [ "$SUSPEITOS" -gt 0 ]; then
    echo -e "${RED}   ⚠️  ENCONTRADO: $SUSPEITOS processos suspeitos de mineração!${NC}"
else
    echo -e "${GREEN}   ✓ Nenhum processo de mineração óbvio encontrado${NC}"
fi

#-------------------------------------------------------------------------------
# 2. CRONTABS - PERSISTÊNCIA
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[2/12] VERIFICANDO CRONTABS...${NC}"

echo "=== CRONTABS DO SISTEMA ===" > "$REPORT_DIR/02-crontabs.txt"
for user in $(cut -f1 -d: /etc/passwd); do
    crontab -l -u "$user" 2>/dev/null | grep -v "^#" | grep -v "^$" && echo "^^^ Crontab de: $user" >> "$REPORT_DIR/02-crontabs.txt"
done

echo -e "\n=== /etc/crontab ===" >> "$REPORT_DIR/02-crontabs.txt"
cat /etc/crontab >> "$REPORT_DIR/02-crontabs.txt" 2>/dev/null

echo -e "\n=== /etc/cron.d/ ===" >> "$REPORT_DIR/02-crontabs.txt"
ls -la /etc/cron.d/ >> "$REPORT_DIR/02-crontabs.txt" 2>/dev/null
for f in /etc/cron.d/*; do
    echo "--- $f ---" >> "$REPORT_DIR/02-crontabs.txt"
    cat "$f" >> "$REPORT_DIR/02-crontabs.txt" 2>/dev/null
done

echo -e "\n=== /etc/cron.hourly/ ===" >> "$REPORT_DIR/02-crontabs.txt"
ls -la /etc/cron.hourly/ >> "$REPORT_DIR/02-crontabs.txt" 2>/dev/null

echo -e "\n=== /etc/cron.daily/ ===" >> "$REPORT_DIR/02-crontabs.txt"
ls -la /etc/cron.daily/ >> "$REPORT_DIR/02-crontabs.txt" 2>/dev/null

# Procurar crontabs suspeitos
CRON_SUSPEITO=$(grep -riE '(curl|wget|bash|sh|python).*http' /etc/cron* /var/spool/cron 2>/dev/null | wc -l)
if [ "$CRON_SUSPEITO" -gt 0 ]; then
    echo -e "${RED}   ⚠️  ENCONTRADO: $CRON_SUSPEITO entradas cron suspeitas com downloads!${NC}"
    grep -riE '(curl|wget|bash|sh|python).*http' /etc/cron* /var/spool/cron 2>/dev/null >> "$REPORT_DIR/02-crontabs.txt"
else
    echo -e "${GREEN}   ✓ Nenhum crontab com download suspeito${NC}"
fi

#-------------------------------------------------------------------------------
# 3. SERVIÇOS SYSTEMD SUSPEITOS
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[3/12] VERIFICANDO SERVIÇOS SYSTEMD...${NC}"

echo "=== SERVIÇOS ATIVOS ===" > "$REPORT_DIR/03-systemd.txt"
systemctl list-units --type=service --state=running >> "$REPORT_DIR/03-systemd.txt" 2>/dev/null

echo -e "\n=== SERVIÇOS HABILITADOS ===" >> "$REPORT_DIR/03-systemd.txt"
systemctl list-unit-files --type=service --state=enabled >> "$REPORT_DIR/03-systemd.txt" 2>/dev/null

echo -e "\n=== SERVIÇOS EM /etc/systemd/system (customizados) ===" >> "$REPORT_DIR/03-systemd.txt"
ls -la /etc/systemd/system/*.service 2>/dev/null >> "$REPORT_DIR/03-systemd.txt"

echo -e "\n=== SERVIÇOS EM ~/.config/systemd (usuário) ===" >> "$REPORT_DIR/03-systemd.txt"
find /home -name "*.service" -path "*systemd*" 2>/dev/null >> "$REPORT_DIR/03-systemd.txt"

# Procurar serviços suspeitos
SERV_SUSPEITO=$(systemctl list-unit-files --type=service 2>/dev/null | grep -iE '(miner|kdevtmp|kinsing|solr\.|bot\.)' | wc -l)
if [ "$SERV_SUSPEITO" -gt 0 ]; then
    echo -e "${RED}   ⚠️  ENCONTRADO: $SERV_SUSPEITO serviços suspeitos!${NC}"
else
    echo -e "${GREEN}   ✓ Nenhum serviço systemd suspeito óbvio${NC}"
fi

#-------------------------------------------------------------------------------
# 4. CONEXÕES DE REDE
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[4/12] ANALISANDO CONEXÕES DE REDE...${NC}"

echo "=== CONEXÕES ESTABELECIDAS ===" > "$REPORT_DIR/04-rede.txt"
ss -tunap 2>/dev/null >> "$REPORT_DIR/04-rede.txt" || netstat -tunap >> "$REPORT_DIR/04-rede.txt" 2>/dev/null

echo -e "\n=== PORTAS EM ESCUTA ===" >> "$REPORT_DIR/04-rede.txt"
ss -tlnp 2>/dev/null >> "$REPORT_DIR/04-rede.txt" || netstat -tlnp >> "$REPORT_DIR/04-rede.txt" 2>/dev/null

echo -e "\n=== CONEXÕES PARA IPs EXTERNOS (não RFC1918) ===" >> "$REPORT_DIR/04-rede.txt"
ss -tunap 2>/dev/null | grep ESTAB | grep -v -E '(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)' >> "$REPORT_DIR/04-rede.txt"

# IPs únicos conectados
echo -e "\n=== IPs EXTERNOS ÚNICOS ===" >> "$REPORT_DIR/04-rede.txt"
ss -tunap 2>/dev/null | grep ESTAB | awk '{print $6}' | cut -d: -f1 | grep -v -E '(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|::)' | sort -u >> "$REPORT_DIR/04-rede.txt"

CONEXOES_EXT=$(ss -tunap 2>/dev/null | grep ESTAB | grep -v -E '(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)' | wc -l)
echo -e "${CYAN}   ℹ️  $CONEXOES_EXT conexões externas estabelecidas${NC}"

#-------------------------------------------------------------------------------
# 5. ARQUIVOS EM /tmp E /dev/shm (comum para malware)
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[5/12] VERIFICANDO /tmp E /dev/shm...${NC}"

echo "=== ARQUIVOS EXECUTÁVEIS EM /tmp ===" > "$REPORT_DIR/05-tmp-shm.txt"
find /tmp -type f -executable 2>/dev/null >> "$REPORT_DIR/05-tmp-shm.txt"

echo -e "\n=== ARQUIVOS OCULTOS EM /tmp ===" >> "$REPORT_DIR/05-tmp-shm.txt"
find /tmp -name ".*" -type f 2>/dev/null >> "$REPORT_DIR/05-tmp-shm.txt"

echo -e "\n=== CONTEÚDO DE /dev/shm ===" >> "$REPORT_DIR/05-tmp-shm.txt"
ls -laR /dev/shm/ 2>/dev/null >> "$REPORT_DIR/05-tmp-shm.txt"

echo -e "\n=== ARQUIVOS EXECUTÁVEIS EM /dev/shm ===" >> "$REPORT_DIR/05-tmp-shm.txt"
find /dev/shm -type f -executable 2>/dev/null >> "$REPORT_DIR/05-tmp-shm.txt"

echo -e "\n=== ARQUIVOS EM /var/tmp ===" >> "$REPORT_DIR/05-tmp-shm.txt"
find /var/tmp -type f -executable 2>/dev/null >> "$REPORT_DIR/05-tmp-shm.txt"

TMP_EXEC=$(find /tmp /dev/shm /var/tmp -type f -executable 2>/dev/null | wc -l)
if [ "$TMP_EXEC" -gt 0 ]; then
    echo -e "${RED}   ⚠️  ENCONTRADO: $TMP_EXEC arquivos executáveis em diretórios temporários!${NC}"
else
    echo -e "${GREEN}   ✓ Nenhum executável suspeito em /tmp ou /dev/shm${NC}"
fi

#-------------------------------------------------------------------------------
# 6. ARQUIVOS MODIFICADOS RECENTEMENTE
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[6/12] ARQUIVOS MODIFICADOS NAS ÚLTIMAS 24H...${NC}"

echo "=== BINÁRIOS MODIFICADOS EM /usr/bin NAS ÚLTIMAS 24H ===" > "$REPORT_DIR/06-modificados.txt"
find /usr/bin /usr/sbin /bin /sbin -type f -mtime -1 2>/dev/null >> "$REPORT_DIR/06-modificados.txt"

echo -e "\n=== ARQUIVOS MODIFICADOS EM /etc NAS ÚLTIMAS 24H ===" >> "$REPORT_DIR/06-modificados.txt"
find /etc -type f -mtime -1 2>/dev/null >> "$REPORT_DIR/06-modificados.txt"

echo -e "\n=== SCRIPTS .SH MODIFICADOS NAS ÚLTIMAS 24H ===" >> "$REPORT_DIR/06-modificados.txt"
find / -name "*.sh" -type f -mtime -1 2>/dev/null | head -50 >> "$REPORT_DIR/06-modificados.txt"

BIN_MOD=$(find /usr/bin /usr/sbin /bin /sbin -type f -mtime -1 2>/dev/null | wc -l)
if [ "$BIN_MOD" -gt 0 ]; then
    echo -e "${RED}   ⚠️  ALERTA: $BIN_MOD binários do sistema modificados nas últimas 24h!${NC}"
else
    echo -e "${GREEN}   ✓ Binários do sistema sem modificações recentes${NC}"
fi

#-------------------------------------------------------------------------------
# 7. USUÁRIOS E SSH
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[7/12] VERIFICANDO USUÁRIOS E SSH...${NC}"

echo "=== USUÁRIOS COM SHELL ===" > "$REPORT_DIR/07-usuarios.txt"
grep -v '/nologin\|/false' /etc/passwd >> "$REPORT_DIR/07-usuarios.txt"

echo -e "\n=== USUÁRIOS COM UID 0 (root) ===" >> "$REPORT_DIR/07-usuarios.txt"
awk -F: '$3 == 0 {print}' /etc/passwd >> "$REPORT_DIR/07-usuarios.txt"

echo -e "\n=== AUTHORIZED_KEYS DE TODOS OS USUÁRIOS ===" >> "$REPORT_DIR/07-usuarios.txt"
for home in /root /home/*; do
    if [ -f "$home/.ssh/authorized_keys" ]; then
        echo "--- $home/.ssh/authorized_keys ---" >> "$REPORT_DIR/07-usuarios.txt"
        cat "$home/.ssh/authorized_keys" >> "$REPORT_DIR/07-usuarios.txt"
    fi
done

echo -e "\n=== LOGINS RECENTES ===" >> "$REPORT_DIR/07-usuarios.txt"
last -20 >> "$REPORT_DIR/07-usuarios.txt" 2>/dev/null

echo -e "\n=== LOGINS FALHOS ===" >> "$REPORT_DIR/07-usuarios.txt"
lastb -20 >> "$REPORT_DIR/07-usuarios.txt" 2>/dev/null

ROOTS=$(awk -F: '$3 == 0 {print}' /etc/passwd | wc -l)
if [ "$ROOTS" -gt 1 ]; then
    echo -e "${RED}   ⚠️  ALERTA: $ROOTS usuários com UID 0 (deveria ser só root)!${NC}"
else
    echo -e "${GREEN}   ✓ Apenas root tem UID 0${NC}"
fi

#-------------------------------------------------------------------------------
# 8. PROCESSOS OCULTOS (comparação /proc com ps)
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[8/12] PROCURANDO PROCESSOS OCULTOS...${NC}"

echo "=== COMPARAÇÃO /proc vs ps ===" > "$REPORT_DIR/08-proc-ocultos.txt"
PROC_PIDS=$(ls -d /proc/[0-9]* 2>/dev/null | wc -l)
PS_PIDS=$(ps aux | wc -l)
echo "PIDs em /proc: $PROC_PIDS" >> "$REPORT_DIR/08-proc-ocultos.txt"
echo "PIDs em ps: $PS_PIDS" >> "$REPORT_DIR/08-proc-ocultos.txt"

# Processos com exe deletado (comum em malware)
echo -e "\n=== PROCESSOS COM BINÁRIO DELETADO ===" >> "$REPORT_DIR/08-proc-ocultos.txt"
for pid in /proc/[0-9]*; do
    exe=$(readlink "$pid/exe" 2>/dev/null)
    if echo "$exe" | grep -q "(deleted)"; then
        echo "PID: $(basename $pid) - $exe" >> "$REPORT_DIR/08-proc-ocultos.txt"
        echo "Cmdline: $(cat $pid/cmdline 2>/dev/null | tr '\0' ' ')" >> "$REPORT_DIR/08-proc-ocultos.txt"
    fi
done

DELETED=$(grep -c "deleted" "$REPORT_DIR/08-proc-ocultos.txt" 2>/dev/null || echo 0)
if [ "$DELETED" -gt 0 ]; then
    echo -e "${RED}   ⚠️  CRÍTICO: $DELETED processos com binário deletado (típico de malware)!${NC}"
else
    echo -e "${GREEN}   ✓ Nenhum processo com binário deletado${NC}"
fi

#-------------------------------------------------------------------------------
# 9. MÓDULOS DO KERNEL (rootkits)
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[9/12] VERIFICANDO MÓDULOS DO KERNEL...${NC}"

echo "=== MÓDULOS CARREGADOS ===" > "$REPORT_DIR/09-kernel.txt"
lsmod >> "$REPORT_DIR/09-kernel.txt" 2>/dev/null

echo -e "\n=== MÓDULOS SUSPEITOS ===" >> "$REPORT_DIR/09-kernel.txt"
lsmod | grep -iE '(hide|root|kit|diamorphine|reptile|adore)' >> "$REPORT_DIR/09-kernel.txt" 2>/dev/null

echo -e "${GREEN}   ✓ Módulos do kernel listados${NC}"

#-------------------------------------------------------------------------------
# 10. DOCKER CONTAINERS
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[10/12] VERIFICANDO DOCKER...${NC}"

echo "=== CONTAINERS DOCKER ===" > "$REPORT_DIR/10-docker.txt"
docker ps -a >> "$REPORT_DIR/10-docker.txt" 2>/dev/null

echo -e "\n=== IMAGENS DOCKER ===" >> "$REPORT_DIR/10-docker.txt"
docker images >> "$REPORT_DIR/10-docker.txt" 2>/dev/null

echo -e "\n=== CONTAINERS COM PRIVILEGED OU HOST NETWORK ===" >> "$REPORT_DIR/10-docker.txt"
docker ps --format '{{.Names}}' 2>/dev/null | while read c; do
    docker inspect "$c" 2>/dev/null | grep -E '(Privileged|NetworkMode.*host)' && echo "^^^ Container: $c"
done >> "$REPORT_DIR/10-docker.txt"

echo -e "${GREEN}   ✓ Docker verificado${NC}"

#-------------------------------------------------------------------------------
# 11. LOGS DO SISTEMA
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[11/12] COLETANDO LOGS RELEVANTES...${NC}"

echo "=== AUTH.LOG (últimas 100 linhas) ===" > "$REPORT_DIR/11-logs.txt"
tail -100 /var/log/auth.log >> "$REPORT_DIR/11-logs.txt" 2>/dev/null

echo -e "\n=== SYSLOG (últimas 100 linhas) ===" >> "$REPORT_DIR/11-logs.txt"
tail -100 /var/log/syslog >> "$REPORT_DIR/11-logs.txt" 2>/dev/null

echo -e "\n=== MENSAGENS DE OOM KILLER ===" >> "$REPORT_DIR/11-logs.txt"
dmesg | grep -i "oom\|killed process" >> "$REPORT_DIR/11-logs.txt" 2>/dev/null

echo -e "\n=== ERROS DO KERNEL ===" >> "$REPORT_DIR/11-logs.txt"
dmesg | grep -iE "(error|fail|segfault)" | tail -50 >> "$REPORT_DIR/11-logs.txt" 2>/dev/null

OOM=$(dmesg 2>/dev/null | grep -c "oom\|killed process" || echo 0)
if [ "$OOM" -gt 0 ]; then
    echo -e "${YELLOW}   ⚠️  $OOM eventos de OOM Killer encontrados (servidor sem memória)${NC}"
else
    echo -e "${GREEN}   ✓ Nenhum evento de OOM Killer${NC}"
fi

#-------------------------------------------------------------------------------
# 12. VERIFICAÇÃO DE INTEGRIDADE
#-------------------------------------------------------------------------------
echo -e "${YELLOW}[12/12] VERIFICANDO INTEGRIDADE DE BINÁRIOS CRÍTICOS...${NC}"

echo "=== HASH DE BINÁRIOS CRÍTICOS ===" > "$REPORT_DIR/12-integridade.txt"
for bin in /usr/bin/curl /usr/bin/wget /bin/bash /usr/bin/ssh /usr/bin/scp /usr/bin/crontab; do
    if [ -f "$bin" ]; then
        md5sum "$bin" >> "$REPORT_DIR/12-integridade.txt" 2>/dev/null
    fi
done

echo -e "\n=== VERIFICAÇÃO COM DEBSUMS (se disponível) ===" >> "$REPORT_DIR/12-integridade.txt"
if command -v debsums &> /dev/null; then
    debsums -c 2>/dev/null | head -50 >> "$REPORT_DIR/12-integridade.txt"
fi

echo -e "${GREEN}   ✓ Hashes coletados${NC}"

#-------------------------------------------------------------------------------
# RESUMO FINAL
#-------------------------------------------------------------------------------
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   RESUMO DA INVESTIGAÇÃO${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}RELATÓRIO SALVO EM: $REPORT_DIR${NC}"
echo ""
echo "Arquivos gerados:"
ls -la "$REPORT_DIR"

echo ""
echo -e "${YELLOW}PRÓXIMOS PASSOS RECOMENDADOS:${NC}"
echo "1. Revise $REPORT_DIR/01-processos.txt - procure processos estranhos"
echo "2. Revise $REPORT_DIR/02-crontabs.txt - procure downloads automáticos"
echo "3. Revise $REPORT_DIR/04-rede.txt - procure IPs suspeitos"
echo "4. Revise $REPORT_DIR/08-proc-ocultos.txt - binários deletados são críticos!"
echo ""
echo -e "${YELLOW}PARA ENVIAR O RELATÓRIO:${NC}"
echo "tar -czf /tmp/security-report.tar.gz $REPORT_DIR"
echo ""

# Criar arquivo de resumo
echo "=== RESUMO EXECUTIVO ===" > "$REPORT_DIR/00-RESUMO.txt"
echo "Data: $(date)" >> "$REPORT_DIR/00-RESUMO.txt"
echo "Hostname: $(hostname)" >> "$REPORT_DIR/00-RESUMO.txt"
echo "" >> "$REPORT_DIR/00-RESUMO.txt"
echo "Processos suspeitos mineração: $SUSPEITOS" >> "$REPORT_DIR/00-RESUMO.txt"
echo "Crontabs com downloads: $CRON_SUSPEITO" >> "$REPORT_DIR/00-RESUMO.txt"
echo "Executáveis em /tmp: $TMP_EXEC" >> "$REPORT_DIR/00-RESUMO.txt"
echo "Binários sistema modificados 24h: $BIN_MOD" >> "$REPORT_DIR/00-RESUMO.txt"
echo "Processos com binário deletado: $DELETED" >> "$REPORT_DIR/00-RESUMO.txt"
echo "Usuários com UID 0: $ROOTS" >> "$REPORT_DIR/00-RESUMO.txt"
echo "Eventos OOM Killer: $OOM" >> "$REPORT_DIR/00-RESUMO.txt"
echo "Conexões externas: $CONEXOES_EXT" >> "$REPORT_DIR/00-RESUMO.txt"

echo -e "${GREEN}✅ Investigação concluída!${NC}"
