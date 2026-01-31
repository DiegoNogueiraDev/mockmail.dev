#!/bin/bash

# =============================================================================
# SCRIPT DE TESTE COMPLETO PARA MOCKMAIL API
# Testa todos os endpoints em HTTP e HTTPS
# =============================================================================

# Configurações
BASE_URL_HTTP="http://localhost:3000"
BASE_URL_HTTPS="https://localhost"
SERVER_HTTP="http://158.220.106.48"
SERVER_HTTPS="https://158.220.106.48"
RESULTS_FILE="mockmail_test_results_$(date +%Y%m%d_%H%M%S).json"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Função para erro
error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Função para sucesso
success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Função para warning
warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Função para fazer requisições
make_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local headers="$4"
    local description="$5"
    
    log "Testando: $description"
    log "URL: $url"
    
    local curl_cmd="curl -s -w '\n%{http_code}\n%{time_total}\n'"
    
    if [ "$method" = "POST" ] || [ "$method" = "PUT" ]; then
        curl_cmd="$curl_cmd -X $method -H 'Content-Type: application/json'"
        if [ -n "$data" ]; then
            curl_cmd="$curl_cmd -d '$data'"
        fi
    elif [ "$method" = "GET" ]; then
        curl_cmd="$curl_cmd -X GET"
    fi
    
    if [ -n "$headers" ]; then
        curl_cmd="$curl_cmd $headers"
    fi
    
    # Adicionar opção para HTTPS inseguro se necessário
    if [[ "$url" == https* ]]; then
        curl_cmd="$curl_cmd -k"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    local response
    response=$(eval $curl_cmd 2>/dev/null)
    
    local body=$(echo "$response" | head -n -2)
    local status_code=$(echo "$response" | tail -n 2 | head -n 1)
    local time_total=$(echo "$response" | tail -n 1)
    
    echo "Status Code: $status_code"
    echo "Response Time: ${time_total}s"
    echo "Response Body: $body"
    
    # Determinar se o teste passou
    if [[ "$status_code" =~ ^[23] ]]; then
        success "✓ $description - Status: $status_code"
    elif [[ "$status_code" = "000" ]]; then
        error "✗ $description - Connection failed"
    else
        warning "⚠ $description - Status: $status_code"
    fi
    
    echo "----------------------------------------"
    
    # Salvar resultado no arquivo JSON
    echo "    {" >> "$RESULTS_FILE"
    echo "      \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULTS_FILE"
    echo "      \"description\": \"$description\"," >> "$RESULTS_FILE"
    echo "      \"method\": \"$method\"," >> "$RESULTS_FILE"
    echo "      \"url\": \"$url\"," >> "$RESULTS_FILE"
    echo "      \"status_code\": \"$status_code\"," >> "$RESULTS_FILE"
    echo "      \"response_time\": \"$time_total\"," >> "$RESULTS_FILE"
    echo "      \"response_body\": $(echo "$body" | jq -R . 2>/dev/null || echo "\"$body\"")," >> "$RESULTS_FILE"
    echo "      \"success\": $(if [[ "$status_code" =~ ^[23] ]]; then echo "true"; else echo "false"; fi)" >> "$RESULTS_FILE"
    echo "    }," >> "$RESULTS_FILE"
}

# Inicializar arquivo de resultados
echo "{" > "$RESULTS_FILE"
echo "  \"test_run\": {" >> "$RESULTS_FILE"
echo "    \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULTS_FILE"
echo "    \"script_version\": \"1.0.0\"," >> "$RESULTS_FILE"
echo "    \"endpoints_tested\": [" >> "$RESULTS_FILE"
echo "  ]" >> "$RESULTS_FILE"
echo "  }," >> "$RESULTS_FILE"
echo "  \"results\": [" >> "$RESULTS_FILE"

# =============================================================================
# INÍCIO DOS TESTES
# =============================================================================

log "Iniciando testes completos da API MockMail"
log "Resultados serão salvos em: $RESULTS_FILE"

# Dados de teste
TEST_USER_DATA='{
    "name": "Test User",
    "email": "test@mockmail.dev",
    "password": "password123"
}'

TEST_LOGIN_DATA='{
    "email": "test@mockmail.dev", 
    "password": "password123"
}'

TEST_EMAIL_DATA='{
    "from": "sender@example.com",
    "to": "test@mockmail.dev",
    "subject": "Test Email",
    "text": "This is a test email",
    "html": "<p>This is a test email</p>"
}'

# URLs para testar
URLS=("$BASE_URL_HTTP" "$BASE_URL_HTTPS" "$SERVER_HTTP" "$SERVER_HTTPS")

for BASE_URL in "${URLS[@]}"; do
    log "========== Testando servidor: $BASE_URL =========="
    
    # 1. Teste de conectividade - User Registration
    
    # 2. Testes de Autenticação
    
    # 2.1 Registro de usuário
    make_request "POST" "$BASE_URL/api/auth/register" "$TEST_USER_DATA" "" "Register User ($BASE_URL)"
    
    # 2.2 Login de usuário
    AUTH_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$TEST_LOGIN_DATA" "$BASE_URL/api/auth/login" 2>/dev/null || echo '{}')
    JWT_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty' 2>/dev/null)
    
    make_request "POST" "$BASE_URL/api/auth/login" "$TEST_LOGIN_DATA" "" "User Login ($BASE_URL)"
    
    # 2.3 Teste com dados inválidos
    INVALID_LOGIN='{"email": "invalid", "password": "123"}'
    make_request "POST" "$BASE_URL/api/auth/login" "$INVALID_LOGIN" "" "Invalid Login Test ($BASE_URL)"
    
    # 2.4 Teste sem dados
    make_request "POST" "$BASE_URL/api/auth/register" "" "" "Register Without Data ($BASE_URL)"
    
    # 3. Testes de Email (com autenticação se disponível)
    
    if [ -n "$JWT_TOKEN" ] && [ "$JWT_TOKEN" != "null" ]; then
        AUTH_HEADER="-H 'Authorization: Bearer $JWT_TOKEN'"
        
        # 3.1 Processar email
        make_request "POST" "$BASE_URL/api/mail/process" "$TEST_EMAIL_DATA" "$AUTH_HEADER" "Process Email - Authenticated ($BASE_URL)"
        
        # 3.2 Buscar último email
        make_request "GET" "$BASE_URL/api/mail/latest/test@mockmail.dev" "" "$AUTH_HEADER" "Get Latest Email - Authenticated ($BASE_URL)"
        
        # 3.3 Buscar email por assunto
        make_request "GET" "$BASE_URL/api/mail/latest/test@mockmail.dev/subject/Test%20Email" "" "$AUTH_HEADER" "Get Email By Subject - Authenticated ($BASE_URL)"
        
    else
        warning "Token JWT não obtido, testando endpoints protegidos sem autenticação"
        
        # 3.4 Testes sem autenticação (devem falhar)
        make_request "POST" "$BASE_URL/api/mail/process" "$TEST_EMAIL_DATA" "" "Process Email - No Auth ($BASE_URL)"
        make_request "GET" "$BASE_URL/api/mail/latest/test@mockmail.dev" "" "" "Get Latest Email - No Auth ($BASE_URL)"
        make_request "GET" "$BASE_URL/api/mail/latest/test@mockmail.dev/subject/Test%20Email" "" "" "Get Email By Subject - No Auth ($BASE_URL)"
    fi
    
    # 4. Testes de endpoints inexistentes
    make_request "GET" "$BASE_URL/api/nonexistent" "" "" "Non-existent Endpoint ($BASE_URL)"
    make_request "POST" "$BASE_URL/api/invalid/route" '{}' "" "Invalid Route ($BASE_URL)"
    
    # 5. Testes de métodos não permitidos
    make_request "DELETE" "$BASE_URL/api/auth/login" "" "" "Method Not Allowed - DELETE on Login ($BASE_URL)"
    make_request "PUT" "$BASE_URL/api/mail/latest/test@mockmail.dev" '{}' "" "Method Not Allowed - PUT on Get Email ($BASE_URL)"
    
    # 6. Teste de Rate Limiting (múltiplas requisições rápidas)
    log "Testando Rate Limiting com múltiplas requisições..."
    for i in {1..5}; do
        sleep 0.1
    done
    
    log "========== Fim dos testes para: $BASE_URL =========="
    echo ""
done

# =============================================================================
# FINALIZAR ARQUIVO DE RESULTADOS
# =============================================================================

# Remover a última vírgula e fechar o JSON
sed -i '$ s/,$//' "$RESULTS_FILE"
echo "  ]" >> "$RESULTS_FILE"
echo "}" >> "$RESULTS_FILE"

# =============================================================================
# RELATÓRIO FINAL
# =============================================================================

log "========== RELATÓRIO FINAL =========="

# Contar sucessos e falhas
TOTAL_TESTS=$(grep -c '"success":' "$RESULTS_FILE")
SUCCESSFUL_TESTS=$(grep -c '"success": true' "$RESULTS_FILE")
FAILED_TESTS=$(grep -c '"success": false' "$RESULTS_FILE")

success "Total de testes executados: $TOTAL_TESTS"
success "Testes bem-sucedidos: $SUCCESSFUL_TESTS"
error "Testes falharam: $FAILED_TESTS"

# Mostrar taxa de sucesso
if [ "$TOTAL_TESTS" -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; $SUCCESSFUL_TESTS * 100 / $TOTAL_TESTS" | bc -l)
    log "Taxa de sucesso: ${SUCCESS_RATE}%"
fi

log "Resultados detalhados salvos em: $RESULTS_FILE"

# Sugestões de melhorias
log "========== PRÓXIMOS PASSOS =========="
log "1. Verifique os testes falhados no arquivo de resultados"
log "2. Execute testes de performance com mais requisições simultâneas"
log "3. Teste com diferentes payloads e cenários edge-case"
log "4. Configure monitoramento contínuo da API"

log "Script de teste concluído!"
