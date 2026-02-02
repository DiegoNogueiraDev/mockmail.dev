#!/bin/bash
# Aplicar Últimas Recomendações de Segurança

echo "═══════════════════════════════════════════════════════════"
echo "  APLICANDO ÚLTIMAS RECOMENDAÇÕES"
echo "═══════════════════════════════════════════════════════════"

# 1. Revisar e opcionalmente remover chave SSH "vps-2025"
echo ""
echo "[1/3] Revisando chaves SSH..."
echo ""
echo "Você tem 5 chaves SSH autorizadas:"
cat ~/.ssh/authorized_keys | awk '{print "  • "$3}'
echo ""
echo "A chave 'vps-2025' foi identificada como potencial ponto de entrada."
echo ""

# Criar backup antes de qualquer alteração
cp ~/.ssh/authorized_keys ~/security-backups/authorized_keys.$(date +%Y%m%d-%H%M%S).backup
echo "✓ Backup criado em ~/security-backups/"

read -p "Deseja REMOVER a chave 'vps-2025'? (s/N): " response
if [[ "$response" =~ ^[Ss]$ ]]; then
    # Remover linha com vps-2025
    grep -v "vps-2025" ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.tmp
    mv ~/.ssh/authorized_keys.tmp ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    echo "✓ Chave 'vps-2025' REMOVIDA com sucesso!"
    echo "✓ Backup mantido em ~/security-backups/"
else
    echo "⚠ Chave 'vps-2025' MANTIDA - revise manualmente se necessário"
fi

# 2. Trocar senha
echo ""
echo "[2/3] Trocar senha do usuário..."
echo ""
echo "É ALTAMENTE RECOMENDADO trocar sua senha agora."
read -p "Deseja trocar a senha agora? (s/N): " response
if [[ "$response" =~ ^[Ss]$ ]]; then
    passwd
else
    echo "⚠ Senha NÃO alterada - troque assim que possível com: passwd"
fi

# 3. Verificar kernel e recomendar reboot
echo ""
echo "[3/3] Verificando kernel..."
CURRENT_KERNEL=$(uname -r)
LATEST_KERNEL=$(dpkg --list | grep linux-image | grep -v "rc" | sort -V | tail -1 | awk '{print $2}' | sed 's/linux-image-//')

echo "  Kernel atual: $CURRENT_KERNEL"
echo "  Kernel mais recente instalado: $LATEST_KERNEL"

if [ "$CURRENT_KERNEL" != "$LATEST_KERNEL" ]; then
    echo ""
    echo "⚠ Há um kernel mais recente instalado!"
    echo "  Recomenda-se reiniciar o servidor para carregar o novo kernel."
    echo ""
    read -p "Deseja REINICIAR o servidor agora? (s/N): " response
    if [[ "$response" =~ ^[Ss]$ ]]; then
        echo ""
        echo "═══════════════════════════════════════════════════════════"
        echo "  REINICIANDO SERVIDOR EM 10 SEGUNDOS..."
        echo "═══════════════════════════════════════════════════════════"
        sleep 10
        sudo reboot
    else
        echo "⚠ Reinicie manualmente quando conveniente: sudo reboot"
    fi
else
    echo "✓ Kernel está atualizado!"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RECOMENDAÇÕES APLICADAS!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Próximos passos:"
echo "  • Execute verificações diárias: ~/GUIA-RAPIDO-VERIFICACAO.sh"
echo "  • Monitore alertas: tail -f ~/security-alerts.log"
echo "  • Revise fail2ban: sudo fail2ban-client status sshd"
echo ""
