#!/bin/bash

# =============================================================================
# Script para Gerar Certificados SSL - MockMail.dev
# =============================================================================
# Gera certificados Let's Encrypt para todos os domínios
# =============================================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Gerador de Certificados SSL - MockMail.dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Este script precisa ser executado como root (sudo)"
    exit 1
fi

# Verificar se certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo "❌ Certbot não está instalado!"
    echo ""
    echo "Instale com:"
    echo "  sudo dnf install certbot python3-certbot-nginx -y"
    exit 1
fi

# Verificar se HAProxy está rodando
if ! systemctl is-active --quiet haproxy; then
    echo "⚠️  HAProxy não está rodando. Iniciando..."
    systemctl start haproxy
fi

# Email para notificações
read -p "📧 Digite seu email para notificações do Let's Encrypt: " EMAIL

if [ -z "$EMAIL" ]; then
    echo "❌ Email é obrigatório!"
    exit 1
fi

echo ""
echo "📋 Domínios que serão certificados:"
echo "   1. mockmail.dev (Produção - Frontend)"
echo "   2. api.mockmail.dev (Produção - API)"
echo "   3. homologacao.mockmail.dev (Homologação - Frontend)"
echo "   4. api.homologacao.mockmail.dev (Homologação - API)"
echo ""
read -p "Deseja continuar? (s/n): " CONFIRM

if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo "❌ Operação cancelada!"
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Gerando certificados..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Criar diretório para webroot se não existir
mkdir -p /var/www/html/.well-known/acme-challenge

# Array de domínios
DOMAINS=(
    "mockmail.dev"
    "api.mockmail.dev"
    "homologacao.mockmail.dev"
    "api.homologacao.mockmail.dev"
)

# Gerar certificados para cada domínio
for DOMAIN in "${DOMAINS[@]}"; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📝 Gerando certificado para: $DOMAIN"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    certbot certonly \
        --webroot \
        --webroot-path=/var/www/html \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAIN" \
        --non-interactive
    
    if [ $? -eq 0 ]; then
        echo "✅ Certificado gerado com sucesso para: $DOMAIN"
    else
        echo "❌ Erro ao gerar certificado para: $DOMAIN"
        exit 1
    fi
    echo ""
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 Convertendo certificados para HAProxy..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Criar diretório para certificados do HAProxy
mkdir -p /etc/ssl/haproxy

# Converter certificados para formato HAProxy (.pem)
for DOMAIN in "${DOMAINS[@]}"; do
    echo "📝 Convertendo: $DOMAIN"
    
    CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
    
    if [ -d "$CERT_PATH" ]; then
        # Combinar cert + chain + privkey em um único arquivo .pem
        cat "$CERT_PATH/fullchain.pem" "$CERT_PATH/privkey.pem" > "/etc/ssl/haproxy/$DOMAIN.pem"
        
        # Ajustar permissões
        chmod 600 "/etc/ssl/haproxy/$DOMAIN.pem"
        chown haproxy:haproxy "/etc/ssl/haproxy/$DOMAIN.pem"
        
        echo "✅ Certificado convertido: /etc/ssl/haproxy/$DOMAIN.pem"
    else
        echo "❌ Certificado não encontrado em: $CERT_PATH"
    fi
    echo ""
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Reiniciando HAProxy..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Testar configuração do HAProxy
haproxy -c -f /etc/haproxy/haproxy.cfg

if [ $? -eq 0 ]; then
    echo "✅ Configuração do HAProxy está correta"
    
    # Reiniciar HAProxy
    systemctl restart haproxy
    
    if [ $? -eq 0 ]; then
        echo "✅ HAProxy reiniciado com sucesso"
    else
        echo "❌ Erro ao reiniciar HAProxy"
        exit 1
    fi
else
    echo "❌ Erro na configuração do HAProxy"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Certificados gerados e configurados com sucesso!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Resumo:"
echo "   ✅ mockmail.dev"
echo "   ✅ api.mockmail.dev"
echo "   ✅ homologacao.mockmail.dev"
echo "   ✅ api.homologacao.mockmail.dev"
echo ""
echo "📁 Certificados salvos em: /etc/ssl/haproxy/"
echo ""
echo "🔄 Renovação automática:"
echo "   Os certificados serão renovados automaticamente pelo certbot."
echo "   Para testar a renovação, execute:"
echo "   sudo certbot renew --dry-run"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   Configure um cron job para recarregar o HAProxy após renovação:"
echo "   echo '0 0 * * * /usr/bin/certbot renew --post-hook \"systemctl reload haproxy\"' | sudo crontab -"
echo ""
