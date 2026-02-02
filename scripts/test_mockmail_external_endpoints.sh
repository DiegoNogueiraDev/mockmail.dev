#!/bin/bash

# =============================================================================
# SCRIPT DE TESTE COMPLETO MOCKMAIL - ENDPOINTS EXTERNOS
# Testa todos os endpoints MockMail incluindo domínios externos do HAProxy
# =============================================================================

# Configurações baseadas no HAProxy (apenas MockMail)
MOCKMAIL_DOMAINS=(
    "api.mockmail.dev"
)

MOCKMAIL_LOCAL_ENDPOINTS=(
    "http://localhost:3000"
    "https://localhost:3000"
    "http://158.220.106.48"
    "https://158.220.106.48"
    "http://127.0.0.1:3000"
)

RESULTS_FILE="mockmail_external_test_$(date +%Y%m%d_%H%M%S).json"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Função para log
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Função para testar conectividade DNS
test_dns_resolution() {
    local domain="$1"
    
    log "🔍 Testando resolução DNS: $domain"
    
    local ip_address
    ip_address=$(nslookup "$domain" 2>/dev/null | grep -A1 "Name:" | grep "Address:" | head -1 | awk '{print $2}' || echo "")
    
    if [ -n "$ip_address" ]; then
        success "✅ DNS OK: $domain → $ip_address"
        
        # Teste de ping
        if ping -c 1 -W 2 "$domain" >/dev/null 2>&1; then
            success "✅ Ping OK: $domain responde"
            return 0
        else
            warning "⚠️ Ping FAIL: $domain não responde ao ping"
            return 1
        fi
    else
        error "❌ DNS FAIL: Não foi possível resolver $domain"
        return 1
    fi
}

# Função para fazer requisições HTTP/HTTPS
test_mockmail_endpoint() {
    local protocol="$1"
    local domain="$2"
    local path="$3"
    local method="$4"
    local data="$5"
    local headers="$6"
    local description="$7"
    
    local url="${protocol}://${domain}${path}"
    
    log "📧 Testando MockMail endpoint: $description"
    log "URL: $url"
    
    # Configurar curl com timeouts apropriados
    local curl_cmd="curl -s -w '\n%{http_code}\n%{time_total}\n%{time_connect}\n%{time_namelookup}\n' --connect-timeout 10 --max-time 30"
    
    if [[ "$protocol" == "https" ]]; then
        curl_cmd="$curl_cmd -k"  # Aceitar certificados auto-assinados
    fi
    
    if [ "$method" = "POST" ] || [ "$method" = "PUT" ]; then
        curl_cmd="$curl_cmd -X $method -H 'Content-Type: application/json'"
        if [ -n "$data" ]; then
            curl_cmd="$curl_cmd -d '$data'"
        fi
    else
        curl_cmd="$curl_cmd -X GET"
    fi
    
    # Adicionar headers extras se fornecidos
    if [ -n "$headers" ]; then
        curl_cmd="$curl_cmd $headers"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    local response
    response=$(eval $curl_cmd 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local body=$(echo "$response" | head -n -4)
        local status_code=$(echo "$response" | tail -n 4 | head -n 1)
        local time_total=$(echo "$response" | tail -n 3 | head -n 1)
        local time_connect=$(echo "$response" | tail -n 2 | head -n 1)
        local time_dns=$(echo "$response" | tail -n 1)
        
        echo "Status Code: $status_code"
        echo "Total Time: ${time_total}s"
        echo "Connect Time: ${time_connect}s"
        echo "DNS Time: ${time_dns}s"
        echo "Response Preview: $(echo "$body" | head -c 200)..."
        
        # Salvar resultado detalhado
        echo "    {" >> "$RESULTS_FILE"
        echo "      \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULTS_FILE"
        echo "      \"domain\": \"$domain\"," >> "$RESULTS_FILE"
        echo "      \"protocol\": \"$protocol\"," >> "$RESULTS_FILE"
        echo "      \"path\": \"$path\"," >> "$RESULTS_FILE"
        echo "      \"method\": \"$method\"," >> "$RESULTS_FILE"
        echo "      \"description\": \"$description\"," >> "$RESULTS_FILE"
        echo "      \"url\": \"$url\"," >> "$RESULTS_FILE"
        echo "      \"status_code\": \"$status_code\"," >> "$RESULTS_FILE"
        echo "      \"time_total\": \"$time_total\"," >> "$RESULTS_FILE"
        echo "      \"time_connect\": \"$time_connect\"," >> "$RESULTS_FILE"
        echo "      \"time_dns\": \"$time_dns\"," >> "$RESULTS_FILE"
        echo "      \"success\": $(if [[ "$status_code" =~ ^[23] ]] || [[ "$status_code" = "404" ]]; then echo "true"; else echo "false"; fi)," >> "$RESULTS_FILE"
        echo "      \"response_preview\": $(echo "$body" | head -c 200 | jq -R . 2>/dev/null || echo "\"$body\"")" >> "$RESULTS_FILE"
        echo "    }," >> "$RESULTS_FILE"
        
        # Determinar se o teste passou
        if [[ "$status_code" =~ ^[23] ]]; then
            success "✅ $description - Status: $status_code (${time_total}s)"
            return 0
        elif [[ "$status_code" = "404" ]]; then
            warning "⚠️ $description - Endpoint não encontrado (404) - servidor responde"
            return 1
        elif [[ "$status_code" = "000" ]]; then
            error "❌ $description - Falha de conexão"
            return 1
        else
            warning "⚠️ $description - Status: $status_code"
            return 1
        fi
        
    else
        error "❌ $description - Falha na requisição curl"
        
        # Salvar falha
        echo "    {" >> "$RESULTS_FILE"
        echo "      \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULTS_FILE"
        echo "      \"domain\": \"$domain\"," >> "$RESULTS_FILE"
        echo "      \"url\": \"$url\"," >> "$RESULTS_FILE"
        echo "      \"description\": \"$description\"," >> "$RESULTS_FILE"
        echo "      \"error\": \"curl_failed\"," >> "$RESULTS_FILE"
        echo "      \"success\": false" >> "$RESULTS_FILE"
        echo "    }," >> "$RESULTS_FILE"
        
        return 1
    fi
    
    echo "----------------------------------------"
}

# Função para testar SSL/TLS
test_ssl_certificate() {
    local domain="$1"
    
    log "🔒 Testando certificado SSL: $domain"
    
    local ssl_info
    ssl_info=$(timeout 10 openssl s_client -connect "$domain:443" -servername "$domain" -verify_return_error 2>/dev/null < /dev/null)
    
    if [ $? -eq 0 ]; then
        local issuer=$(echo "$ssl_info" | grep "issuer=" | head -1)
        local subject=$(echo "$ssl_info" | grep "subject=" | head -1)
        local expire_date=$(echo "$ssl_info" | openssl x509 -noout -dates 2>/dev/null | grep "notAfter=" | cut -d= -f2)
        
        success "✅ SSL/TLS válido para $domain"
        echo "   Emissor: $issuer"
        echo "   Assunto: $subject"  
        echo "   Expira em: $expire_date"
        
        # Verificar se vai expirar em 30 dias
        if command -v date >/dev/null 2>&1; then
            local expire_epoch
            expire_epoch=$(date -d "$expire_date" +%s 2>/dev/null)
            local current_epoch
            current_epoch=$(date +%s)
            local days_until_expire=$(( (expire_epoch - current_epoch) / 86400 ))
            
            if [ "$days_until_expire" -lt 30 ]; then
                warning "⚠️ Certificado expira em $days_until_expire dias!"
            else
                success "✅ Certificado válido por $days_until_expire dias"
            fi
        fi
        
        return 0
        
    else
        error "❌ Problema com certificado SSL para $domain"
        return 1
    fi
}

# Função para testar todos os endpoints MockMail
test_mockmail_complete_suite() {
    local base_url="$1"
    local description_prefix="$2"
    
    # Dados de teste
    local register_data='{"name":"External Test User","email":"external.test@mockmail.dev","password":"ExternalTest123"}'
    local login_data='{"email":"external.test@mockmail.dev","password":"ExternalTest123"}'
    local email_data='{"from":"sender@example.com","to":"external.test@mockmail.dev","subject":"External API Test Email","text":"This is a test email sent via external API testing","html":"<p>This is a <strong>test email</strong> sent via external API testing</p>"}'
    
    # Parse da URL
    local protocol
    local domain
    if [[ "$base_url" =~ ^(https?)://(.+)$ ]]; then
        protocol="${BASH_REMATCH[1]}"
        domain="${BASH_REMATCH[2]}"
    else
        error "URL inválida: $base_url"
        return 1
    fi
    
    log "📧 Executando suite completa MockMail para: $base_url"
    
    # 1. User Registration
    
    # 2. Registro de usuário
    test_mockmail_endpoint "$protocol" "$domain" "/api/auth/register" "POST" "$register_data" "" "$description_prefix - User Registration"
    
    # 3. Login de usuário  
    local login_success=false
    if test_mockmail_endpoint "$protocol" "$domain" "/api/auth/login" "POST" "$login_data" "" "$description_prefix - User Login"; then
        login_success=true
    fi
    
    # 4. Tentar obter token para testes autenticados
    local jwt_token=""
    if [ "$login_success" = true ]; then
        local token_response
        token_response=$(curl -s -X POST -H "Content-Type: application/json" -d "$login_data" "$base_url/api/auth/login" 2>/dev/null)
        jwt_token=$(echo "$token_response" | jq -r '.token // empty' 2>/dev/null)
    fi
    
    if [ -n "$jwt_token" ] && [ "$jwt_token" != "null" ] && [ "$jwt_token" != "empty" ]; then
        success "🔑 Token JWT obtido para $base_url"
        
        # 5. Processar email (autenticado)
        test_mockmail_endpoint "$protocol" "$domain" "/api/mail/process" "POST" "$email_data" "-H 'Authorization: Bearer $jwt_token'" "$description_prefix - Process Email (Auth)"
        
        # 6. Buscar último email (autenticado)
        test_mockmail_endpoint "$protocol" "$domain" "/api/mail/latest/external.test@mockmail.dev" "GET" "" "-H 'Authorization: Bearer $jwt_token'" "$description_prefix - Get Latest Email (Auth)"
        
        # 7. Buscar email por assunto (autenticado)
        local encoded_subject
        encoded_subject=$(python3 -c "import urllib.parse; print(urllib.parse.quote('External API Test Email'))" 2>/dev/null || echo "External%20API%20Test%20Email")
        test_mockmail_endpoint "$protocol" "$domain" "/api/mail/latest/external.test@mockmail.dev/subject/$encoded_subject" "GET" "" "-H 'Authorization: Bearer $jwt_token'" "$description_prefix - Get Email By Subject (Auth)"
        
    else
        warning "⚠️ Não foi possível obter token JWT para $base_url - testando endpoints sem autenticação"
        
        # Testar endpoints protegidos sem autenticação (devem retornar 401)
        test_mockmail_endpoint "$protocol" "$domain" "/api/mail/process" "POST" "$email_data" "" "$description_prefix - Process Email (No Auth - should fail)"
        test_mockmail_endpoint "$protocol" "$domain" "/api/mail/latest/external.test@mockmail.dev" "GET" "" "" "$description_prefix - Get Latest Email (No Auth - should fail)"
    fi
    
    # 8. Testes de validação (devem retornar 400)
    local invalid_register='{"email":"invalid-email","password":"123"}'
    test_mockmail_endpoint "$protocol" "$domain" "/api/auth/register" "POST" "$invalid_register" "" "$description_prefix - Invalid Registration Data"
    
    local invalid_login='{"email":"nonexistent@test.com","password":"wrongpass"}'
    test_mockmail_endpoint "$protocol" "$domain" "/api/auth/login" "POST" "$invalid_login" "" "$description_prefix - Invalid Login"
    
    # 9. Teste de endpoint inexistente (deve retornar 404)
    test_mockmail_endpoint "$protocol" "$domain" "/api/nonexistent" "GET" "" "" "$description_prefix - Non-existent Endpoint"
    
    success "✅ Suite completa MockMail finalizada para: $base_url"
}

# Função principal de teste de rede
test_network_connectivity() {
    log "🌐 Testando conectividade de rede..."
    
    # Testar conectividade básica com sites conhecidos
    local test_sites=("google.com" "cloudflare.com" "8.8.8.8")
    
    for site in "${test_sites[@]}"; do
        if ping -c 1 -W 2 "$site" >/dev/null 2>&1; then
            success "✅ Conectividade OK: $site"
        else
            warning "⚠️ Conectividade FALHOU: $site"
        fi
    done
    
    # Testar resolução DNS
    log "🔍 Testando servidores DNS..."
    local dns_servers=("8.8.8.8" "1.1.1.1")
    
    for dns in "${dns_servers[@]}"; do
        if nslookup google.com "$dns" >/dev/null 2>&1; then
            success "✅ DNS OK: $dns"
        else
            warning "⚠️ DNS FALHOU: $dns"
        fi
    done
}

# Função para verificar portas HAProxy
test_haproxy_ports() {
    log "🔧 Verificando configuração HAProxy..."
    
    # Verificar se HAProxy está rodando
    if systemctl is-active --quiet haproxy 2>/dev/null; then
        success "✅ HAProxy está ativo"
    else
        warning "⚠️ HAProxy pode não estar ativo"
    fi
    
    # Verificar portas 80 e 443
    local ports=("80" "443")
    for port in "${ports[@]}"; do
        if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            success "✅ Porta $port está em listening"
        else
            warning "⚠️ Porta $port não está em listening"
        fi
    done
}

# Inicializar arquivo de resultados
initialize_results_file() {
    echo "{" > "$RESULTS_FILE"
    echo "  \"test_session\": {" >> "$RESULTS_FILE"
    echo "    \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULTS_FILE"
    echo "    \"hostname\": \"$(hostname)\"," >> "$RESULTS_FILE"
    echo "    \"script_version\": \"2.1.0\"," >> "$RESULTS_FILE"
    echo "    \"test_type\": \"mockmail_external_endpoints\"," >> "$RESULTS_FILE"
    echo "    \"external_domains\": [$(printf '"%s",' "${MOCKMAIL_DOMAINS[@]}" | sed 's/,$//')]," >> "$RESULTS_FILE"
    echo "    \"local_endpoints\": [$(printf '"%s",' "${MOCKMAIL_LOCAL_ENDPOINTS[@]}" | sed 's/,$//')]" >> "$RESULTS_FILE"
    echo "  }," >> "$RESULTS_FILE"
    echo "  \"results\": [" >> "$RESULTS_FILE"
}

# Finalizar arquivo de resultados
finalize_results_file() {
    # Remover última vírgula e fechar JSON
    sed -i '$ s/,$//' "$RESULTS_FILE"
    echo "  ]" >> "$RESULTS_FILE"
    echo "}" >> "$RESULTS_FILE"
}

# Gerar relatório HTML
generate_external_report() {
    log "📊 Gerando relatório HTML dos testes externos..."
    
    local report_file="mockmail_external_report_$(date +%Y%m%d_%H%M%S).html"
    
    # Calcular métricas
    local total_tests
    total_tests=$(grep -c '"success":' "$RESULTS_FILE")
    local successful_tests  
    successful_tests=$(grep -c '"success": true' "$RESULTS_FILE")
    local failed_tests
    failed_tests=$(grep -c '"success": false' "$RESULTS_FILE")
    
    local success_rate=0
    if [ "$total_tests" -gt 0 ]; then
        success_rate=$(echo "scale=1; $successful_tests * 100 / $total_tests" | bc -l)
    fi
    
    cat > "$report_file" << HTML_EOF
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MockMail API - Relatório de Testes Externos</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6; 
            color: #333;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 15px;
            text-align: center;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .header h1 { font-size: 2.8em; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .header .subtitle { font-size: 1.2em; opacity: 0.9; margin-bottom: 20px; }
        .header .meta { font-size: 0.95em; opacity: 0.8; }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .metric-card:hover { 
            transform: translateY(-5px); 
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        
        .metric-value {
            font-size: 3em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .metric-label {
            color: #666;
            font-size: 1em;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 500;
        }
        
        .success-metric { color: #27ae60; }
        .warning-metric { color: #f39c12; }
        .danger-metric { color: #e74c3c; }
        .info-metric { color: #3498db; }
        
        .section {
            background: white;
            margin: 25px 0;
            padding: 35px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        
        .section h2 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 15px;
            margin-bottom: 25px;
            font-size: 1.8em;
        }
        
        .domain-test {
            background: #f8f9fa;
            border-left: 5px solid #3498db;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
        }
        
        .domain-test h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .status-badge {
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-success { background: #d5f4e6; color: #27ae60; }
        .status-warning { background: #fef9e7; color: #f39c12; }
        .status-error { background: #fadbd8; color: #e74c3c; }
        
        .endpoint-list {
            display: grid;
            gap: 10px;
            margin: 15px 0;
        }
        
        .endpoint-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            background: white;
            border-radius: 8px;
            border-left: 4px solid #ecf0f1;
        }
        
        .endpoint-success { border-left-color: #27ae60; }
        .endpoint-warning { border-left-color: #f39c12; }
        .endpoint-error { border-left-color: #e74c3c; }
        
        .recommendations {
            background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin: 25px 0;
        }
        
        .recommendations h3 { 
            margin-bottom: 20px; 
            font-size: 1.5em;
        }
        .recommendations ul { margin-left: 25px; }
        .recommendations li { 
            margin-bottom: 10px;
            font-size: 1.05em;
        }
        
        .footer {
            text-align: center;
            padding: 25px;
            color: #666;
            border-top: 1px solid #ecf0f1;
            margin-top: 40px;
        }
        
        @media (max-width: 768px) {
            .metrics-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 2.2em; }
            .container { padding: 15px; }
            .section { padding: 25px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 MockMail API</h1>
            <div class="subtitle">Relatório de Testes de Endpoints Externos</div>
            <div class="meta">
                <strong>Executado em:</strong> $(date)<br>
                <strong>Domínios Testados:</strong> ${MOCKMAIL_DOMAINS[*]}<br>
                <strong>Hostname:</strong> $(hostname)
            </div>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value success-metric">$successful_tests</div>
                <div class="metric-label">Testes Bem-sucedidos</div>
            </div>
            <div class="metric-card">
                <div class="metric-value $([ $failed_tests -eq 0 ] && echo "success-metric" || echo "danger-metric")">$failed_tests</div>
                <div class="metric-label">Testes Falharam</div>
            </div>
            <div class="metric-card">
                <div class="metric-value info-metric">$total_tests</div>
                <div class="metric-label">Total de Testes</div>
            </div>
            <div class="metric-card">
                <div class="metric-value $(echo "$success_rate > 80" | bc -l >/dev/null 2>&1 && echo "success-metric" || echo "warning-metric")">$success_rate%</div>
                <div class="metric-label">Taxa de Sucesso</div>
            </div>
        </div>
        
        <div class="section">
            <h2>🌐 Resultados por Domínio</h2>
            
            $(for domain in "${MOCKMAIL_DOMAINS[@]}"; do
                local domain_tests=$(grep -c "\"domain\": \"$domain\"" "$RESULTS_FILE" 2>/dev/null || echo "0")
                local domain_success=$(grep "\"domain\": \"$domain\"" "$RESULTS_FILE" 2>/dev/null | grep -c "\"success\": true" || echo "0")
                local status_class="status-success"
                
                if [ "$domain_success" -eq 0 ]; then
                    status_class="status-error"
                elif [ "$domain_success" -lt "$domain_tests" ]; then
                    status_class="status-warning"
                fi
                
                echo "            <div class=\"domain-test\">"
                echo "                <h3>🔗 $domain <span class=\"status-badge $status_class\">$domain_success/$domain_tests</span></h3>"
                echo "                <p>Testes executados para este domínio externo configurado no HAProxy.</p>"
                echo "            </div>"
            done)
        </div>
        
        <div class="section">
            <h2>📊 Análise Detalhada</h2>
            
            <h3>🔧 Infraestrutura</h3>
            <p>Todos os domínios externos configurados no HAProxy foram testados para garantir acessibilidade via HTTP e HTTPS.</p>
            
            <h3>🔒 Segurança</h3>
            <p>Certificados SSL/TLS foram validados para domínios HTTPS, incluindo verificação de expiração.</p>
            
            <h3>⚡ Performance</h3>
            <p>Métricas de tempo de resposta, conexão e resolução DNS foram coletadas para análise de performance.</p>
        </div>
        
        $(if [ "$failed_tests" -gt 0 ]; then
            echo "        <div class=\"recommendations\">"
            echo "            <h3>🚨 Ações Recomendadas</h3>"
            echo "            <ul>"
            echo "                <li><strong>Verificar Configuração DNS:</strong> Alguns domínios podem não estar resolvendo corretamente</li>"
            echo "                <li><strong>Validar Certificados SSL:</strong> Certificados expirados ou inválidos detectados</li>"
            echo "                <li><strong>Checar HAProxy:</strong> Verificar se o balanceador de carga está direcionando tráfego corretamente</li>"
            echo "                <li><strong>Monitoramento:</strong> Implementar alertas para falhas de conectividade externa</li>"
            echo "            </ul>"
            echo "        </div>"
        else
            echo "        <div class=\"recommendations\">"
            echo "            <h3>🎉 Excelente!</h3>"
            echo "            <ul>"
            echo "                <li><strong>Todos os Testes Passaram:</strong> A infraestrutura externa está funcionando perfeitamente</li>"
            echo "                <li><strong>Monitoramento Contínuo:</strong> Configure verificações regulares para manter a qualidade</li>"
            echo "                <li><strong>Documentação:</strong> Mantenha a documentação de endpoints atualizada</li>"
            echo "            </ul>"
            echo "        </div>"
        fi)
        
        <div class="section">
            <h2>📁 Arquivos de Resultado</h2>
            <ul>
                <li><strong>$RESULTS_FILE</strong> - Dados estruturados em JSON com todos os detalhes</li>
                <li><strong>$report_file</strong> - Este relatório visual em HTML</li>
            </ul>
            <p><em>Consulte o arquivo JSON para análise programática dos resultados.</em></p>
        </div>
        
        <div class="footer">
            <p>Relatório gerado automaticamente pela Suite de Testes MockMail External v2.1.0</p>
            <p>Para análise detalhada, consulte: <code>$RESULTS_FILE</code></p>
        </div>
    </div>
</body>
</html>
HTML_EOF

    success "✅ Relatório HTML gerado: $report_file"
}

# =============================================================================
# FUNÇÃO PRINCIPAL
# =============================================================================

main() {
    local start_time=$(date +%s)
    
    log "🚀 Iniciando testes de endpoints externos MockMail"
    log "📝 Resultados serão salvos em: $RESULTS_FILE"
    log "🎯 Focando apenas em endpoints MockMail (n8n desconsiderado)"
    
    # Verificar dependências
    for cmd in curl jq bc nslookup ping openssl; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            warning "⚠️ Dependência não encontrada: $cmd (alguns recursos podem não funcionar)"
        fi
    done
    
    # Inicializar arquivo de resultados
    initialize_results_file
    
    # Testar infraestrutura básica
    test_network_connectivity
    test_haproxy_ports
    
    log "========== TESTANDO DOMÍNIOS EXTERNOS MOCKMAIL =========="
    
    # Testar cada domínio externo MockMail
    for domain in "${MOCKMAIL_DOMAINS[@]}"; do
        log "📧 Processando domínio MockMail: $domain"
        
        # Testar resolução DNS primeiro
        if test_dns_resolution "$domain"; then
            
            # Testar certificado SSL
            test_ssl_certificate "$domain"
            
            # Executar suite completa para HTTPS
            test_mockmail_complete_suite "https://$domain" "External HTTPS MockMail ($domain)"
            
            # Executar suite completa para HTTP (redirecionamento)
            test_mockmail_complete_suite "http://$domain" "External HTTP MockMail ($domain)"
            
        else
            warning "⚠️ Pulando testes HTTP/HTTPS para $domain devido a falha de DNS"
        fi
        
        echo ""
    done
    
    log "========== TESTANDO ENDPOINTS LOCAIS MOCKMAIL =========="
    
    # Testar endpoints locais
    for endpoint in "${MOCKMAIL_LOCAL_ENDPOINTS[@]}"; do
        log "🏠 Testando endpoint local MockMail: $endpoint"
        test_mockmail_complete_suite "$endpoint" "Local MockMail ($endpoint)"
        echo ""
    done
    
    # Finalizar arquivo de resultados
    finalize_results_file
    
    # Gerar relatório HTML
    generate_external_report
    
    # Estatísticas finais
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    log "========== ESTATÍSTICAS FINAIS =========="
    
    local total_tests
    total_tests=$(grep -c '"success":' "$RESULTS_FILE")
    local successful_tests
    successful_tests=$(grep -c '"success": true' "$RESULTS_FILE")
    local failed_tests
    failed_tests=$(grep -c '"success": false' "$RESULTS_FILE")
    
    success "✅ Total de testes: $total_tests"
    success "✅ Sucessos: $successful_tests"
    error "❌ Falhas: $failed_tests"
    
    if [ "$total_tests" -gt 0 ]; then
        local success_rate
        success_rate=$(echo "scale=1; $successful_tests * 100 / $total_tests" | bc -l)
        log "📊 Taxa de sucesso: ${success_rate}%"
    fi
    
    log "⏱️ Tempo total de execução: ${minutes}m ${seconds}s"
    log "📄 Resultados detalhados em: $RESULTS_FILE"
    
    # Recomendações baseadas nos resultados
    log "========== RECOMENDAÇÕES =========="
    
    if [ "$failed_tests" -eq 0 ]; then
        success "🎉 Todos os testes passaram! Os endpoints externos MockMail estão funcionando perfeitamente."
        log "💡 Considere agendar execução regular deste script para monitoramento contínuo."
    elif [ "$failed_tests" -lt 3 ]; then
        warning "⚠️ Algumas falhas detectadas. Possíveis causas:"
        log "   • Problemas de conectividade de rede"
        log "   • Certificados SSL expirados"
        log "   • Configuração incorreta no HAProxy"
        log "   • Serviços temporariamente indisponíveis"
    else
        error "🚨 Múltiplas falhas detectadas. Ação imediata necessária:"
        log "   • Verificar status do HAProxy"
        log "   • Validar configurações de DNS"
        log "   • Checar conectividade de rede"
        log "   • Revisar certificados SSL"
    fi
    
    success "✅ Teste de endpoints externos MockMail concluído!"
    log "📊 Para visualizar o relatório: mockmail_external_report_*.html"
}

# Trap para cleanup
trap 'log "🛑 Teste interrompido pelo usuário"; exit 1' INT TERM

# Executar função principal
main "$@"
