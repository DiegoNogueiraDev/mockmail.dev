#!/bin/bash
# Guia Rápido de Verificação de Segurança

echo "═══════════════════════════════════════════════════════════"
echo "  VERIFICAÇÃO RÁPIDA DE SEGURANÇA"
echo "═══════════════════════════════════════════════════════════"

# 1. Verificar processos de mineração
echo -e "\n[1] Verificando processos de mineração..."
MINERS=$(ps aux | grep -iE "xmrig|stratum|minerd|cpuminer|defunct|syssls" | grep -v grep | wc -l)
if [ $MINERS -eq 0 ]; then
    echo "  ✓ Nenhum minerador detectado"
else
    echo "  ✗ ALERTA: $MINERS processos suspeitos!"
    ps aux | grep -iE "xmrig|stratum|minerd|cpuminer|defunct|syssls" | grep -v grep
fi

# 2. Verificar uso de CPU
echo -e "\n[2] Uso de CPU:"
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
echo "  CPU: ${CPU}% (alerta se > 80%)"

# 3. Verificar memória
echo -e "\n[3] Memória disponível:"
free -h | grep Mem | awk '{print "  Total: "$2" | Usado: "$3" | Livre: "$4}'

# 4. Verificar firewall
echo -e "\n[4] Status do firewall:"
sudo ufw status | grep "Status:" | awk '{print "  "$0}'

# 5. Verificar fail2ban
echo -e "\n[5] IPs banidos pelo fail2ban:"
BANNED=$(sudo fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $4}')
echo "  Atualmente banidos: $BANNED IPs"

# 6. Verificar chaves SSH
echo -e "\n[6] Chaves SSH autorizadas:"
echo "  Total: $(cat ~/.ssh/authorized_keys | wc -l) chaves"
cat ~/.ssh/authorized_keys | awk '{print "  - "$3}' | sort -u

# 7. Verificar integridade dos arquivos de configuração
echo -e "\n[7] Verificando arquivos críticos por malware..."
BASHRC_SUSPICIOUS=$(grep -E "base64|curl.*sh|wget.*sh" ~/.bashrc 2>/dev/null | wc -l)
if [ $BASHRC_SUSPICIOUS -eq 0 ]; then
    echo "  ✓ .bashrc limpo"
else
    echo "  ✗ ALERTA: .bashrc contém código suspeito!"
fi

# 8. Verificar serviços na porta 8080
echo -e "\n[8] Verificando porta 8080 suspeita..."
PORT_8080=$(sudo lsof -ti:8080 2>/dev/null)
if [ -z "$PORT_8080" ]; then
    echo "  ✓ Porta 8080 não está em uso"
else
    echo "  ⚠ Porta 8080 em uso pelo PID $PORT_8080"
    ps aux | grep $PORT_8080 | grep -v grep
fi

# 9. Verificar auditd
echo -e "\n[9] Status do auditd:"
sudo systemctl is-active auditd 2>/dev/null || echo "  ⚠ Auditd não está ativo"

# 10. Última verificação de malware
echo -e "\n[10] Última verificação de segurança:"
if [ -f ~/security-check.log ]; then
    echo "  Última verificação: $(tail -1 ~/security-check.log | grep -oP '\d{4}-\d{2}-\d{2}')"
else
    echo "  ⚠ Nenhuma verificação registrada ainda"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Para verificação completa, execute: ~/daily-security-check.sh"
echo "═══════════════════════════════════════════════════════════"
