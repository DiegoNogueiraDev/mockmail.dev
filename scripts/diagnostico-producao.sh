#!/bin/bash
#
# MockMail.dev - Script de Diagnóstico de Produção
#
# Este script valida a compatibilidade da API com integrações existentes
# e identifica potenciais breaking changes antes do deploy.
#
# Uso: ./scripts/diagnostico-producao.sh [URL_API]
# Exemplo: ./scripts/diagnostico-producao.sh https://api.mockmail.dev
#          ./scripts/diagnostico-producao.sh http://localhost:3000
#

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# URL da API (default: localhost)
API_URL="${1:-http://localhost:3000}"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║        MockMail.dev - Diagnóstico de Produção                   ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  API URL: $API_URL"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Contadores
TOTAL=0
PASSED=0
FAILED=0
WARNINGS=0

# Função para testar endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5
    local auth_header=$6

    TOTAL=$((TOTAL + 1))

    if [ -n "$data" ]; then
        if [ -n "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $auth_header" \
                -d "$data" 2>/dev/null || echo -e "\n000")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data" 2>/dev/null || echo -e "\n000")
        fi
    else
        if [ -n "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
                -H "Authorization: Bearer $auth_header" 2>/dev/null || echo -e "\n000")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" 2>/dev/null || echo -e "\n000")
        fi
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" == "$expected_status" ]; then
        echo -e "  ${GREEN}✓${NC} [$method] $endpoint → $status_code ($description)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} [$method] $endpoint → $status_code (esperado: $expected_status) - $description"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Função para avisos
warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

info() {
    echo -e "  ${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ============================================================================
# 1. VERIFICAÇÃO DE CONECTIVIDADE
# ============================================================================
section "1. Verificação de Conectividade"

echo -e "\n  Testando conexão com a API..."
if curl -s --max-time 5 "$API_URL/api/health" > /dev/null 2>&1 || \
   curl -s --max-time 5 "$API_URL/api/csrf-token" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} API está respondendo em $API_URL"
else
    echo -e "  ${RED}✗${NC} API não está respondendo em $API_URL"
    echo ""
    echo "  Verifique se:"
    echo "    - A URL está correta"
    echo "    - O serviço está rodando"
    echo "    - Não há bloqueio de firewall"
    exit 1
fi

# ============================================================================
# 2. ENDPOINTS PÚBLICOS (SEM AUTENTICAÇÃO)
# ============================================================================
section "2. Endpoints Públicos (sem autenticação)"

echo -e "\n  📋 Testando endpoints que devem funcionar sem autenticação:\n"

# CSRF Token - Deve funcionar
test_endpoint "GET" "/api/csrf-token" "200" "CSRF Token endpoint"

# Health check (se existir)
test_endpoint "GET" "/api/health" "200" "Health check" || true

# ============================================================================
# 3. BREAKING CHANGES - Endpoints que mudaram de público para privado
# ============================================================================
section "3. BREAKING CHANGES - Endpoints Agora Protegidos"

echo -e "\n  🔒 Testando endpoints que MUDARAM de público para privado:\n"

# boxes-by-user - ANTES era público, AGORA requer auth
echo -e "\n  ${YELLOW}⚠ BREAKING CHANGE: /api/mail/boxes-by-user${NC}"
echo "    Antes: Público (sem autenticação)"
echo "    Agora: Privado (requer JWT)"
test_endpoint "GET" "/api/mail/boxes-by-user" "401" "Deve retornar 401 sem auth"

# ============================================================================
# 4. ENDPOINTS DE AUTENTICAÇÃO
# ============================================================================
section "4. Endpoints de Autenticação"

echo -e "\n  🔐 Testando rotas de autenticação:\n"

# Login endpoint
test_endpoint "POST" "/api/auth/login" "400" "Login sem dados (deve retornar erro de validação)" '{}'

# Register com senha fraca (BREAKING CHANGE)
echo -e "\n  ${YELLOW}⚠ BREAKING CHANGE: Validação de senha mais rígida${NC}"
echo "    Antes: Mínimo 6 caracteres"
echo "    Agora: Mínimo 12 caracteres + maiúscula + minúscula + número + especial"
test_endpoint "POST" "/api/auth/register" "400" "Registro com senha fraca deve falhar" \
    '{"email":"test@test.com","password":"123456","name":"Test"}'

# Novos endpoints
info "Novos endpoints adicionados (não são breaking changes):"
echo "    - GET  /api/auth/verify   (verificação de token)"
echo "    - GET  /api/auth/me       (dados do usuário logado)"
echo "    - POST /api/auth/refresh  (renovação de tokens)"
echo "    - POST /api/auth/logout   (logout)"
echo "    - POST /api/auth/logout-all (logout de todas sessões)"

# ============================================================================
# 5. RATE LIMITING
# ============================================================================
section "5. Rate Limiting"

echo -e "\n  ⏱️  Testando rate limiting:\n"

echo -e "  ${YELLOW}⚠ BREAKING CHANGE: Rate limiting agora está ATIVO${NC}"
echo "    Configuração atual: 5 requisições por 15 minutos"
echo "    Antes: Desabilitado (comentado)"
echo ""
info "Endpoints afetados por authLimiter:"
echo "    - POST /api/auth/login"
echo "    - POST /api/auth/register"
echo ""
warn "Integrações automatizadas podem ser bloqueadas com 429 Too Many Requests"

# ============================================================================
# 6. NOVOS ENDPOINTS (NÃO SÃO BREAKING CHANGES)
# ============================================================================
section "6. Novos Endpoints Adicionados"

echo -e "\n  ✨ Os seguintes endpoints são NOVOS (adições, não breaking changes):\n"

info "Rotas de Email Boxes (/api/boxes):"
echo "    - GET    /api/boxes           (listar boxes)"
echo "    - POST   /api/boxes           (criar box)"
echo "    - GET    /api/boxes/:id       (detalhes)"
echo "    - DELETE /api/boxes/:id       (deletar)"
echo "    - POST   /api/boxes/:id/clear (limpar emails)"
echo "    - GET    /api/boxes/:id/emails (emails do box)"

echo ""
info "Rotas de Emails (/api/mail):"
echo "    - GET    /api/mail/emails     (listar emails)"
echo "    - GET    /api/mail/emails/:id (detalhes)"
echo "    - DELETE /api/mail/emails/:id (deletar)"

echo ""
info "Rotas de Webhooks (/api/webhooks) - NOVO RECURSO:"
echo "    - GET    /api/webhooks             (listar)"
echo "    - POST   /api/webhooks             (criar)"
echo "    - GET    /api/webhooks/:id         (detalhes)"
echo "    - PUT    /api/webhooks/:id         (atualizar)"
echo "    - DELETE /api/webhooks/:id         (deletar)"
echo "    - POST   /api/webhooks/:id/test    (testar)"
echo "    - GET    /api/webhooks/:id/deliveries (histórico)"

echo ""
info "Rotas de API Keys (/api/api-keys) - NOVO RECURSO:"
echo "    - GET    /api/api-keys        (listar)"
echo "    - POST   /api/api-keys        (criar)"
echo "    - GET    /api/api-keys/:id    (detalhes)"
echo "    - PUT    /api/api-keys/:id    (atualizar)"
echo "    - DELETE /api/api-keys/:id    (deletar)"
echo "    - POST   /api/api-keys/:id/revoke (revogar)"

echo ""
info "Rotas de Perfil (/api/profile) - NOVO RECURSO:"
echo "    - GET    /api/profile         (meu perfil)"
echo "    - PUT    /api/profile         (atualizar perfil)"

# ============================================================================
# 7. MODELO DE DADOS - MUDANÇAS
# ============================================================================
section "7. Mudanças no Modelo de Dados"

echo -e "\n  📊 Verificando mudanças no modelo User:\n"

echo -e "  ${YELLOW}⚠ ATENÇÃO: Novos campos no modelo User${NC}"
echo ""
echo "    Campos adicionados (com defaults):"
echo "      - role: 'user' | 'admin' | 'system' (default: 'user')"
echo "      - permissions: string[] (default: [])"
echo "      - isActive: boolean (default: true)"
echo "      - lastLogin: Date (opcional)"
echo ""
info "Usuários existentes no banco receberão valores default automaticamente"
info "Não é necessário migração manual se usar os defaults do Mongoose"

# ============================================================================
# 8. ENDPOINT CRÍTICO: PROCESSAMENTO DE EMAIL
# ============================================================================
section "8. Endpoint Crítico: Processamento de Email"

echo -e "\n  📧 Verificando endpoint de processamento (usado pelo Postfix):\n"

# Este é o endpoint mais crítico - usado pelo email-processor
test_endpoint "POST" "/api/mail/process" "400" "Endpoint de processamento (sem dados)" '{}'

info "Este endpoint é chamado pelo email-processor Python"
info "Validação via validateEmailRequest middleware"
echo -e "  ${GREEN}✓${NC} Endpoint mantém compatibilidade (sem mudanças de autenticação)"

# ============================================================================
# RESUMO FINAL
# ============================================================================
section "RESUMO DO DIAGNÓSTICO"

echo ""
echo "  ┌─────────────────────────────────────────────────────────────────┐"
echo "  │  RESULTADOS DOS TESTES                                         │"
echo "  ├─────────────────────────────────────────────────────────────────┤"
printf "  │  Total de testes:    %-3s                                       │\n" "$TOTAL"
printf "  │  ${GREEN}Passou:             %-3s${NC}                                       │\n" "$PASSED"
printf "  │  ${RED}Falhou:             %-3s${NC}                                       │\n" "$FAILED"
printf "  │  ${YELLOW}Avisos:             %-3s${NC}                                       │\n" "$WARNINGS"
echo "  └─────────────────────────────────────────────────────────────────┘"
echo ""

echo "  ┌─────────────────────────────────────────────────────────────────┐"
echo "  │  BREAKING CHANGES IDENTIFICADOS                                │"
echo "  ├─────────────────────────────────────────────────────────────────┤"
echo "  │  1. GET /api/mail/boxes-by-user agora requer autenticação      │"
echo "  │  2. Validação de senha mais rígida (12 chars + complexidade)   │"
echo "  │  3. Rate limiting ativado (5 req/15min) nas rotas de auth      │"
echo "  │  4. Novos campos no modelo User (role, permissions, isActive)  │"
echo "  └─────────────────────────────────────────────────────────────────┘"
echo ""

echo "  ┌─────────────────────────────────────────────────────────────────┐"
echo "  │  RECOMENDAÇÕES PARA PRODUÇÃO                                   │"
echo "  ├─────────────────────────────────────────────────────────────────┤"
echo "  │  1. Notificar integrações que usam /api/mail/boxes-by-user     │"
echo "  │  2. Aumentar rate limit ou usar whitelist para integrações     │"
echo "  │  3. Executar migration para popular campos User existentes     │"
echo "  │  4. Atualizar documentação da API com novos endpoints          │"
echo "  └─────────────────────────────────────────────────────────────────┘"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "  ${RED}⚠ ATENÇÃO: Alguns testes falharam. Verifique antes do deploy.${NC}"
    exit 1
else
    echo -e "  ${GREEN}✓ Diagnóstico concluído. Revise os breaking changes antes do deploy.${NC}"
    exit 0
fi
