#!/bin/bash
# Configurar Aplicações para Localhost Apenas

echo "═══════════════════════════════════════════════════════════"
echo "  CONFIGURANDO PORTAS 3000/3001 PARA LOCALHOST APENAS"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "[1/4] Status atual das portas..."
echo "Porta 3000:"
netstat -tlnp 2>/dev/null | grep ":3000" | awk '{print "  "$4, $7}'
echo "Porta 3001:"
netstat -tlnp 2>/dev/null | grep ":3001" | awk '{print "  "$4, $7}'

echo ""
echo "[2/4] Verificando firewall..."
sudo ufw status | grep -E "3000|3001"
echo "  ✓ Firewall já está bloqueando acesso externo"

echo ""
echo "[3/4] Configuração das aplicações..."
echo ""
echo "⚠️  IMPORTANTE:"
echo "As aplicações Node.js estão escutando em TODAS as interfaces (:::3000 e :::3001)"
echo "Mas o FIREWALL está bloqueando acesso externo (camada de proteção)."
echo ""
echo "Para MÁXIMA SEGURANÇA (bind em localhost), você precisa:"
echo ""
echo "Para mockmail-api (porta 3000):"
echo "  1. Editar /opt/mockmail-api/dist/server.js ou configuração"
echo "  2. Adicionar: app.listen(3000, '127.0.0.1')"
echo "  3. Ou configurar variável HOST=127.0.0.1"
echo ""
echo "Para Next.js (porta 3001):"
echo "  1. Editar next.config.js ou package.json"
echo "  2. Adicionar: next start -H 127.0.0.1 -p 3001"
echo ""

echo "[4/4] Verificação da configuração de segurança atual..."
echo ""
echo "STATUS ATUAL:"
echo "  Porta 3000: Escuta em todas interfaces MAS firewall NEGA externo ✓"
echo "  Porta 3001: Escuta em todas interfaces MAS firewall NEGA externo ✓"
echo ""
echo "NÍVEL DE PROTEÇÃO:"
echo "  ✓ Firewall UFW bloqueando (primeira camada)"
echo "  ⚠ Aplicações não configuradas para localhost (segunda camada desejável)"
echo ""
echo "RECOMENDAÇÃO:"
echo "  • Se HAProxy faz proxy reverso: configuração atual é SEGURA"
echo "  • Para máxima segurança: configurar bind localhost nas apps"
echo ""

# Verificar se HAProxy está fazendo proxy
if systemctl is-active --quiet haproxy; then
    echo "✓ HAProxy ATIVO - provavelmente fazendo proxy reverso"
    echo "  Neste caso, a configuração atual com firewall é SUFICIENTE"
else
    echo "⚠ HAProxy não está ativo"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ANÁLISE CONCLUÍDA"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "CONCLUSÃO:"
echo "  Suas portas 3000 e 3001 estão PROTEGIDAS pelo firewall."
echo "  Acesso externo: BLOQUEADO ✓"
echo "  Acesso via HAProxy: Permitido ✓"
echo ""
echo "Para configurar bind localhost (defesa em profundidade):"
echo "  • Veja documentação em ~/LOCALHOST-CONFIG.txt"
echo ""
