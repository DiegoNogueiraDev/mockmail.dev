#!/bin/bash

# =============================================================================
# Script para Gerar Secrets - MockMail.dev
# =============================================================================
# Este script gera todos os secrets necessários para os ambientes
# de homologação e produção do MockMail.dev
# =============================================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Gerador de Secrets - MockMail.dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Função para gerar secrets
generate_secrets() {
    local env=$1
    local env_upper=$(echo "$env" | tr '[:lower:]' '[:upper:]')
    
    echo "📝 Gerando secrets para: $env_upper"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Senhas para bancos de dados (32 caracteres)
    echo "# Senhas para Bancos de Dados (32 caracteres)"
    echo "MONGO_PASSWORD_${env_upper}=$(openssl rand -base64 32)"
    echo "REDIS_PASSWORD_${env_upper}=$(openssl rand -base64 32)"
    echo "POSTGRES_PASSWORD_${env_upper}=$(openssl rand -base64 32)"
    echo ""
    
    # Secrets JWT (64 caracteres - mais seguro)
    echo "# Secrets JWT (64 caracteres - CRÍTICO!)"
    echo "JWT_SECRET_${env_upper}=$(openssl rand -base64 64)"
    echo "JWT_REFRESH_SECRET_${env_upper}=$(openssl rand -base64 64)"
    echo ""
    
    # Secret CSRF (32 caracteres)
    echo "# Secret CSRF (32 caracteres)"
    echo "CSRF_SECRET_${env_upper}=$(openssl rand -base64 32)"
    echo ""
}

# Menu
echo "Escolha o ambiente:"
echo ""
echo "1) Homologação"
echo "2) Produção"
echo "3) Ambos"
echo "4) Sair"
echo ""
read -p "Digite sua escolha (1-4): " choice

case $choice in
    1)
        echo ""
        generate_secrets "hml"
        ;;
    2)
        echo ""
        generate_secrets "prod"
        ;;
    3)
        echo ""
        generate_secrets "hml"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        generate_secrets "prod"
        ;;
    4)
        echo ""
        echo "👋 Saindo..."
        exit 0
        ;;
    *)
        echo ""
        echo "❌ Escolha inválida!"
        exit 1
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Secrets gerados com sucesso!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANTE:"
echo ""
echo "1. Copie os secrets gerados acima"
echo "2. Cole nos arquivos .env correspondentes:"
echo "   - .env.homologacao (raiz e backend/)"
echo "   - .env.producao (raiz e backend/)"
echo "3. NUNCA commite esses arquivos no git!"
echo "4. Guarde uma cópia segura dos secrets (use um gerenciador de senhas)"
echo ""
echo "📖 Para mais informações, consulte: CONFIGURACAO-AMBIENTES.md"
echo ""
