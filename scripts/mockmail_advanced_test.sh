#!/bin/bash

# =============================================================================
# SCRIPT AVANÇADO DE TESTE E MONITORAMENTO MOCKMAIL API
# Inclui testes de performance, stress testing e monitoramento em tempo real
# =============================================================================

# Configurações avançadas
CONCURRENT_USERS=10
DURATION_SECONDS=60
REQUESTS_PER_SECOND=5
BASE_URL="http://localhost:3000"
PERFORMANCE_LOG="mockmail_performance_$(date +%Y%m%d_%H%M%S).log"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$PERFORMANCE_LOG"
}

performance_test() {
    local endpoint="$1"
    local method="$2"
    local data="$3"
    local description="$4"
    
    log "🚀 Iniciando teste de performance: $description"
    
    # Teste de latência
    log "📊 Medindo latência..."
    for i in {1..10}; do
        local response_time=$(curl -o /dev/null -s -w '%{time_total}' \
            -X "$method" \
            -H "Content-Type: application/json" \
            $([ -n "$data" ] && echo "-d '$data'") \
            "$BASE_URL$endpoint")
        echo "Requisição $i: ${response_time}s" >> "$PERFORMANCE_LOG"
    done
    
    # Teste de throughput
    log "⚡ Testando throughput com $CONCURRENT_USERS usuários simultâneos..."
    
    # Criar arquivo temporário para requests
    local temp_script="/tmp/mockmail_load_test_$$.sh"
    cat > "$temp_script" << LOAD_EOF
#!/bin/bash
for i in \$(seq 1 $REQUESTS_PER_SECOND); do
    curl -s -o /dev/null -w '%{http_code}:%{time_total}\\n' \\
        -X "$method" \\
        -H "Content-Type: application/json" \\
        \$([ -n "$data" ] && echo "-d '$data'") \\
        "$BASE_URL$endpoint" &
    sleep 0.1
done
wait
LOAD_EOF
    
    chmod +x "$temp_script"
    
    # Executar teste de carga
    local start_time=$(date +%s)
    for user in $(seq 1 $CONCURRENT_USERS); do
        "$temp_script" > "/tmp/results_user_${user}.log" &
    done
    
    wait
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Analisar resultados
    local total_requests=0
    local successful_requests=0
    local total_time=0
    
    for user in $(seq 1 $CONCURRENT_USERS); do
        while IFS=: read -r status_code response_time; do
            total_requests=$((total_requests + 1))
            if [[ "$status_code" =~ ^2 ]]; then
                successful_requests=$((successful_requests + 1))
            fi
            total_time=$(echo "$total_time + $response_time" | bc -l)
        done < "/tmp/results_user_${user}.log"
        rm -f "/tmp/results_user_${user}.log"
    done
    
    # Calcular métricas
    local success_rate=$(echo "scale=2; $successful_requests * 100 / $total_requests" | bc -l)
    local avg_response_time=$(echo "scale=4; $total_time / $total_requests" | bc -l)
    local throughput=$(echo "scale=2; $total_requests / $duration" | bc -l)
    
    log "📈 Resultados do teste de performance:"
    log "   Total de requisições: $total_requests"
    log "   Requisições bem-sucedidas: $successful_requests"
    log "   Taxa de sucesso: ${success_rate}%"
    log "   Tempo médio de resposta: ${avg_response_time}s"
    log "   Throughput: ${throughput} req/s"
    log "   Duração do teste: ${duration}s"
    
    # Cleanup
    rm -f "$temp_script"
}

stress_test() {
    log "🔥 Iniciando teste de stress..."
    
    # Teste gradual de carga
    for load in 5 10 20 50; do
        log "🔄 Testando com $load requisições simultâneas..."
        
        local temp_stress="/tmp/stress_test_$$.sh"
        cat > "$temp_stress" << STRESS_EOF
#!/bin/bash
for i in \$(seq 1 $load); do
done
wait
STRESS_EOF
        
        chmod +x "$temp_stress"
        local start_time=$(date +%s.%3N)
        local results=$("$temp_stress")
        local end_time=$(date +%s.%3N)
        
        local duration=$(echo "$end_time - $start_time" | bc -l)
        local success_count=$(echo "$results" | grep -c "^200")
        local total_count=$(echo "$results" | wc -l)
        
        log "   Carga: $load | Sucessos: $success_count/$total_count | Tempo: ${duration}s"
        
        rm -f "$temp_stress"
        sleep 2
    done
}

monitor_system_resources() {
    log "📊 Monitorando recursos do sistema..."
    
    # Obter PID do processo mockmail
    local mockmail_pid=$(ps aux | grep "mockmail.*server.js" | grep -v grep | awk '{print $2}' | head -1)
    
    if [ -n "$mockmail_pid" ]; then
        log "🎯 Processo MockMail encontrado (PID: $mockmail_pid)"
        
        # Monitorar por 30 segundos
        for i in {1..30}; do
            local cpu_usage=$(ps -p "$mockmail_pid" -o %cpu --no-headers 2>/dev/null | xargs)
            local mem_usage=$(ps -p "$mockmail_pid" -o %mem --no-headers 2>/dev/null | xargs)
            local mem_kb=$(ps -p "$mockmail_pid" -o rss --no-headers 2>/dev/null | xargs)
            
            if [ -n "$cpu_usage" ]; then
                echo "[$(date '+%H:%M:%S')] CPU: ${cpu_usage}% | RAM: ${mem_usage}% (${mem_kb}KB)" >> "$PERFORMANCE_LOG"
            fi
            
            sleep 1
        done
    else
        log "⚠️ Processo MockMail não encontrado"
    fi
}

test_api_endpoints_performance() {
    log "🎪 Testando performance de todos os endpoints..."
    
    # Dados de teste
    local register_data='{"name":"PerfTest","email":"perf@test.com","password":"password123"}'
    local login_data='{"email":"perf@test.com","password":"password123"}'
    local email_data='{"from":"test@example.com","to":"perf@test.com","subject":"Performance Test","text":"Testing performance"}'
    
    # Teste de endpoints
    performance_test "/api/auth/register" "POST" "$register_data" "User Registration"
    performance_test "/api/auth/login" "POST" "$login_data" "User Login"
    
    # Obter token para testes autenticados
    local auth_response=$(curl -s -X POST -H "Content-Type: application/json" -d "$login_data" "$BASE_URL/api/auth/login")
    local jwt_token=$(echo "$auth_response" | jq -r '.token // empty' 2>/dev/null)
    
    if [ -n "$jwt_token" ] && [ "$jwt_token" != "null" ]; then
        log "🔑 Token obtido, testando endpoints autenticados..."
        
        # Modificar função para incluir autenticação
        performance_test_with_auth() {
            local endpoint="$1"
            local method="$2" 
            local data="$3"
            local description="$4"
            
            log "🔒 Testando endpoint autenticado: $description"
            
            for i in {1..10}; do
                local response_time=$(curl -o /dev/null -s -w '%{time_total}' \
                    -X "$method" \
                    -H "Content-Type: application/json" \
                    -H "Authorization: Bearer $jwt_token" \
                    $([ -n "$data" ] && echo "-d '$data'") \
                    "$BASE_URL$endpoint")
                echo "Auth Request $i: ${response_time}s" >> "$PERFORMANCE_LOG"
            done
        }
        
        performance_test_with_auth "/api/mail/process" "POST" "$email_data" "Email Processing"
        performance_test_with_auth "/api/mail/latest/perf@test.com" "GET" "" "Get Latest Email"
    fi
}

generate_report() {
    log "📋 Gerando relatório de performance..."
    
    local report_file="mockmail_performance_report_$(date +%Y%m%d_%H%M%S).html"
    
    cat > "$report_file" << 'REPORT_EOF'
<!DOCTYPE html>
<html>
<head>
    <title>MockMail Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f8ff; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #007acc; }
        .metric { background-color: #f9f9f9; padding: 10px; margin: 10px 0; }
        .success { color: #008000; }
        .warning { color: #ffa500; }
        .error { color: #ff0000; }
        pre { background-color: #f5f5f5; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 MockMail API - Relatório de Performance</h1>
        <p><strong>Data/Hora:</strong> $(date)</p>
        <p><strong>Servidor:</strong> $BASE_URL</p>
    </div>
    
    <div class="section">
        <h2>📊 Resumo Executivo</h2>
        <div class="metric">
            <strong>Endpoints Testados:</strong> Todos os principais endpoints da API<br>
            <strong>Tipos de Teste:</strong> Latência, Throughput, Stress Testing<br>
            <strong>Duração Total:</strong> Aproximadamente $(date +%M) minutos
        </div>
    </div>
    
    <div class="section">
        <h2>📈 Métricas Detalhadas</h2>
        <p>Consulte o arquivo de log para métricas detalhadas: <code>$PERFORMANCE_LOG</code></p>
    </div>
    
    <div class="section">
        <h2>🛠️ Recomendações</h2>
        <ul>
            <li>Monitorar tempo de resposta médio < 200ms para endpoints GET</li>
            <li>Garantir taxa de sucesso > 95% em condições normais</li>
            <li>Implementar cache para endpoints de consulta frequente</li>
            <li>Configurar alertas para quando CPU > 80% ou RAM > 1GB</li>
        </ul>
    </div>
</body>
</html>
REPORT_EOF

    log "📄 Relatório HTML gerado: $report_file"
}

# =============================================================================
# EXECUÇÃO PRINCIPAL
# =============================================================================

main() {
    log "🎬 Iniciando suite avançada de testes MockMail API"
    log "📝 Log de performance: $PERFORMANCE_LOG"
    
    # Verificar dependências
    command -v jq >/dev/null 2>&1 || { log "⚠️ jq não instalado, alguns recursos podem não funcionar"; }
    command -v bc >/dev/null 2>&1 || { log "⚠️ bc não instalado, cálculos podem falhar"; }
    
    # Verificar se a API está respondendo
    if curl -s --connect-timeout 5 "$BASE_URL/api/auth/login" >/dev/null 2>&1; then
        log "✅ API MockMail está respondendo"
    else
        log "❌ API MockMail não está acessível em $BASE_URL"
        exit 1
    fi
    
    # Executar testes
    log "🔄 Fase 1: Testes de Performance dos Endpoints"
    test_api_endpoints_performance
    
    log "🔄 Fase 2: Teste de Stress"
    stress_test
    
    log "🔄 Fase 3: Monitoramento de Recursos"
    monitor_system_resources &
    MONITOR_PID=$!
    
    # Executar alguns testes enquanto monitora
    sleep 5
    
    # Parar monitoramento
    kill $MONITOR_PID 2>/dev/null
    
    log "🔄 Fase 4: Geração de Relatório"
    generate_report
    
    log "🎉 Suite de testes concluída!"
    log "📊 Verifique os arquivos gerados:"
    log "   - Log detalhado: $PERFORMANCE_LOG"
    log "   - Relatório HTML: mockmail_performance_report_*.html"
}

# Trap para cleanup em caso de interrupção
trap 'log "🛑 Teste interrompido pelo usuário"; exit 1' INT TERM

# Executar função principal
main "$@"
