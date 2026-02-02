#!/bin/bash
# Script de verificação diária de segurança

echo "================================================"
echo "  VERIFICAÇÃO DE SEGURANÇA - $(date)"
echo "================================================"

# 1. Verificar processos suspeitos
echo -e "\n[1/5] Verificando processos de mineração..."
~/check-suspicious-processes.sh

# 2. Verificar uso de recursos
echo -e "\n[2/5] Top 5 processos por CPU:"
ps aux --sort=-%cpu | head -6 | awk '{printf "%-10s %5s %5s %s\n", $1, $3, $4, $11}'

# 3. Verificar uso de memória
echo -e "\n[3/5] Memória disponível:"
free -h | grep Mem

# 4. Verificar conexões de rede suspeitas
echo -e "\n[4/5] Conexões estabelecidas (exceto locais):"
ss -tnp | grep ESTAB | grep -v "127.0.0.1\|::1" | head -10

# 5. Verificar tentativas de login SSH
echo -e "\n[5/5] Últimas tentativas de login:"
last | head -5

echo -e "\n================================================"
echo "  Verificação concluída!"
echo "================================================"
