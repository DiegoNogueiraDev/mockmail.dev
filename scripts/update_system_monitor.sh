#!/bin/bash

# =============================================================================
# Update System Monitor Script
# Updates the existing system monitor to the enhanced v2.0
# =============================================================================

set -euo pipefail

echo "🔄 Atualizando System Health Monitor para v2.0"
echo "============================================="
echo

# Backup do script original se existir
if [[ -f "system_health_monitor.sh" ]]; then
    echo "📦 Fazendo backup do script original..."
    cp system_health_monitor.sh system_health_monitor_v1_backup.sh
    echo "   ✓ Backup salvo como: system_health_monitor_v1_backup.sh"
fi

# Substituir o script principal
if [[ -f "system_health_monitor_v2.sh" ]]; then
    echo "🔄 Atualizando script principal..."
    cp system_health_monitor_v2.sh system_health_monitor.sh
    chmod +x system_health_monitor.sh
    echo "   ✓ Script principal atualizado para v2.0"
else
    echo "❌ Erro: system_health_monitor_v2.sh não encontrado"
    exit 1
fi

# Atualizar configuração de login se existir
if grep -q "SYSTEM_HEALTH_MONITOR_BANNER" ~/.bashrc 2>/dev/null; then
    echo "🔧 Atualizando configuração de login..."
    
    # Remove configuração antiga
    sed -i '/SYSTEM_HEALTH_MONITOR_BANNER/,/SYSTEM_HEALTH_MONITOR_BANNER/d' ~/.bashrc
    
    # Adiciona nova configuração
    cat >> ~/.bashrc << 'BASHRC_CONTENT'

# SYSTEM_HEALTH_MONITOR_BANNER
# Automatically run Enhanced System Health Monitor v2.0 on login
if [[ $- == *i* ]] && [[ -f "$(pwd)/system_health_monitor.sh" ]]; then
    # Only run in interactive shells and if script exists
    "$(pwd)/system_health_monitor.sh"
fi
# SYSTEM_HEALTH_MONITOR_BANNER

BASHRC_CONTENT
    
    echo "   ✓ Configuração de login atualizada"
fi

echo ""
echo "🎉 Atualização Completa!"
echo "======================="
echo ""
echo "📋 O que foi atualizado:"
echo "   • Script principal: system_health_monitor.sh → v2.0"
echo "   • Análise específica do MockMail em /opt/"
echo "   • Monitoramento de containers Docker integradores"
echo "   • Detecção inteligente de processos suspeitos"
echo "   • Análise detalhada de recursos e segurança"
echo ""
echo "🚀 Principais melhorias v2.0:"
echo "   • ✅ Detecta MockMail.dev em /opt/mockmail corretamente"
echo "   • ✅ Identifica N8N, PostgreSQL e MongoDB como integradores"
echo "   • ✅ Análise de portas específicas do MockMail (25,80,443,587,993,995,110,143)"
echo "   • ✅ Monitoramento de logs em /var/log/mockmail"
echo "   • ✅ Eliminação de falsos positivos de segurança"
echo "   • ✅ Recomendações inteligentes de manutenção"
echo ""
echo "💡 Próximos passos:"
echo "   1. Teste o novo script: ./system_health_monitor.sh"
echo "   2. Ele executará automaticamente no próximo login"
echo "   3. Configure monitoramento automático: sudo systemctl enable system-health-monitor.timer"
echo ""
echo "📝 Arquivos disponíveis:"
echo "   • system_health_monitor.sh (v2.0 - atual)"
echo "   • system_health_monitor_v1_backup.sh (backup v1.0)"
echo "   • system_health_monitor_v2.sh (fonte v2.0)"
echo ""
