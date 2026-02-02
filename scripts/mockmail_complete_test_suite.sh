#!/bin/bash

# =============================================================================
# SUITE COMPLETA DE TESTES MOCKMAIL API - VERSÃO 3.0
# Executa todos os tipos de teste incluindo endpoints externos do HAProxy
# =============================================================================

SCRIPT_DIR="/home/anaopcd"
RESULTS_DIR="/home/anaopcd/mockmail_test_results_$(date +%Y%m%d_%H%M%S)"
BASE_URL="http://localhost:3000"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

log() {
    echo -e "${CYAN}[SUITE-$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

setup_test_environment() {
    log "🏗️ Configurando ambiente de testes..."
    
    # Criar diretório de resultados
    mkdir -p "$RESULTS_DIR"
    log "📁 Diretório de resultados criado: $RESULTS_DIR"
    
    # Verificar dependências
    local deps_ok=true
    
    for cmd in curl jq bc python3 nslookup ping openssl; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            error "❌ Dependência não encontrada: $cmd"
            deps_ok=false
        else
            log "✅ Dependência OK: $cmd"
        fi
    done
    
    if [ "$deps_ok" = false ]; then
        error "❌ Instale as dependências faltantes antes de continuar"
        log "💡 Ubuntu/Debian: sudo apt install curl jq bc python3 dnsutils iputils-ping openssl"
        exit 1
    fi
    
    # Verificar se a API está funcionando localmente
    if curl -s --connect-timeout 5 "$BASE_URL/api/auth/login" >/dev/null 2>&1; then
        success "✅ API MockMail local está respondendo em $BASE_URL"
    else
        warning "⚠️ API MockMail local não está acessível em $BASE_URL"
        log "💡 Alguns testes locais podem falhar, mas testes externos continuarão"
    fi
}

run_basic_tests() {
    log "🧪 Executando testes básicos de endpoints..."
    
    cd "$RESULTS_DIR"
    if [ -f "$SCRIPT_DIR/test_mockmail_endpoints.sh" ]; then
        "$SCRIPT_DIR/test_mockmail_endpoints.sh" > basic_tests.log 2>&1
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            success "✅ Testes básicos concluídos com sucesso"
        else
            warning "⚠️ Testes básicos concluídos com avisos (código: $exit_code)"
        fi
    else
        warning "⚠️ Script de testes básicos não encontrado: $SCRIPT_DIR/test_mockmail_endpoints.sh"
    fi
}

run_external_tests() {
    log "🌐 Executando testes de endpoints externos..."
    
    cd "$RESULTS_DIR"
    if [ -f "$SCRIPT_DIR/test_mockmail_external_endpoints.sh" ]; then
        "$SCRIPT_DIR/test_mockmail_external_endpoints.sh" > external_tests.log 2>&1
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            success "✅ Testes externos concluídos com sucesso"
        else
            warning "⚠️ Testes externos concluídos com avisos (código: $exit_code)"
        fi
        
        # Copiar arquivos de resultado específicos dos testes externos
        cp /home/anaopcd/mockmail_external_test_*.json . 2>/dev/null || true
        cp /home/anaopcd/mockmail_external_report_*.html . 2>/dev/null || true
        
    else
        warning "⚠️ Script de testes externos não encontrado: $SCRIPT_DIR/test_mockmail_external_endpoints.sh"
    fi
}

run_performance_tests() {
    log "⚡ Executando testes de performance..."
    
    cd "$RESULTS_DIR" 
    if [ -f "$SCRIPT_DIR/mockmail_advanced_test.sh" ]; then
        "$SCRIPT_DIR/mockmail_advanced_test.sh" > performance_tests.log 2>&1
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            success "✅ Testes de performance concluídos"
        else
            warning "⚠️ Testes de performance concluídos com avisos (código: $exit_code)"
        fi
        
        # Copiar arquivos de performance
        cp /home/anaopcd/mockmail_performance_*.log . 2>/dev/null || true
        cp /home/anaopcd/mockmail_performance_report_*.html . 2>/dev/null || true
        
    else
        warning "⚠️ Script de testes de performance não encontrado: $SCRIPT_DIR/mockmail_advanced_test.sh"
    fi
}

run_security_tests() {
    log "🛡️ Executando testes de segurança..."
    
    cd "$RESULTS_DIR"
    if [ -f "$SCRIPT_DIR/mockmail_security_test.sh" ]; then
        "$SCRIPT_DIR/mockmail_security_test.sh" > security_tests.log 2>&1
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            success "✅ Testes de segurança concluídos"
        else
            warning "⚠️ Testes de segurança concluídos com avisos (código: $exit_code)"
        fi
        
        # Copiar arquivos de segurança
        cp /home/anaopcd/mockmail_security_*.log . 2>/dev/null || true
        cp /home/anaopcd/mockmail_security_report_*.html . 2>/dev/null || true
        
    else
        warning "⚠️ Script de testes de segurança não encontrado: $SCRIPT_DIR/mockmail_security_test.sh"
    fi
}

run_infrastructure_tests() {
    log "🔧 Executando testes de infraestrutura..."
    
    cd "$RESULTS_DIR"
    
    # Teste de HAProxy
    log "Verificando status do HAProxy..."
    systemctl status haproxy --no-pager > haproxy_status.log 2>&1
    
    # Teste de portas
    log "Verificando portas em uso..."
    netstat -tlnp > ports_status.log 2>&1
    
    # Teste de processos MockMail
    log "Verificando processos MockMail..."
    ps aux | grep -i mockmail > mockmail_processes.log
    
    # Teste de logs do sistema
    log "Coletando logs recentes do MockMail..."
    tail -n 100 /var/log/mockmail/email_processor.log > recent_mockmail.log 2>/dev/null || echo "Logs não encontrados" > recent_mockmail.log
    
    success "✅ Testes de infraestrutura concluídos"
}

run_api_documentation_test() {
    log "📚 Verificando documentação da API..."
    
    cd "$RESULTS_DIR"
    
    # Testar se há documentação swagger/openapi disponível
    local docs_endpoints=(
        "/docs"
        "/swagger" 
        "/api-docs"
        "/api/docs"
        "/documentation"
        "/openapi.json"
        "/swagger.json"
    )
    
    local docs_found=false
    echo "Verificando endpoints de documentação:" > api_docs_check.log
    
    for endpoint in "${docs_endpoints[@]}"; do
        local response=$(curl -s -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
        local status_code=$(echo "$response" | tail -c 3)
        echo "  $endpoint: $status_code" >> api_docs_check.log
        
        if [[ "$status_code" =~ ^[23] ]]; then
            success "✅ Documentação encontrada em: $endpoint"
            docs_found=true
            break
        fi
    done
    
    if [ "$docs_found" = false ]; then
        warning "⚠️ Documentação da API não encontrada nos endpoints padrão"
        echo "RECOMENDAÇÃO: Implementar documentação OpenAPI/Swagger" >> api_docs_check.log
    fi
}

generate_consolidated_report() {
    log "📊 Gerando relatório consolidado..."
    
    local report_file="$RESULTS_DIR/consolidated_report.html"
    local summary_file="$RESULTS_DIR/test_summary.txt"
    
    # Contar resultados de diferentes tipos de teste
    local total_basic=$(grep -c "Status Code:" "$RESULTS_DIR/basic_tests.log" 2>/dev/null || echo "0")
    local success_basic=$(grep -c "SUCCESS.*✓" "$RESULTS_DIR/basic_tests.log" 2>/dev/null || echo "0")
    
    local total_external=$(grep -c '"success":' "$RESULTS_DIR"/mockmail_external_test_*.json 2>/dev/null | awk -F: '{sum+=$2} END {print sum}' || echo "0")
    local success_external=$(grep -c '"success": true' "$RESULTS_DIR"/mockmail_external_test_*.json 2>/dev/null | awk -F: '{sum+=$2} END {print sum}' || echo "0")
    
    local total_performance=$(grep -c "Requisição.*:" "$RESULTS_DIR"/*performance*.log 2>/dev/null | awk -F: '{sum+=$2} END {print sum}' || echo "0")
    local security_issues=$(grep -c "VULNERABILIDADE" "$RESULTS_DIR/security_tests.log" 2>/dev/null || echo "0")
    
    # Calcular métricas totais
    local total_tests=$((total_basic + total_external))
    local total_success=$((success_basic + success_external))
    local success_rate=0
    
    if [ "$total_tests" -gt 0 ]; then
        success_rate=$(echo "scale=1; $total_success * 100 / $total_tests" | bc -l)
    fi
    
    # Criar resumo em texto
    cat > "$summary_file" << SUMMARY_EOF
================================================================
MOCKMAIL API - RELATÓRIO CONSOLIDADO DE TESTES v3.0
================================================================
Data: $(date)
Hostname: $(hostname)
Servidor Local: $BASE_URL
Diretório de Resultados: $RESULTS_DIR

RESUMO EXECUTIVO:
├─ Testes Básicos: $success_basic/$total_basic endpoints funcionais
├─ Testes Externos: $success_external/$total_external endpoints HAProxy
├─ Testes de Performance: $total_performance requisições executadas
├─ Questões de Segurança: $security_issues potenciais vulnerabilidades
└─ Taxa de Sucesso Geral: ${success_rate}%

TIPOS DE TESTE EXECUTADOS:
✅ Funcionalidade - Endpoints básicos da API
🌐 Externos - Domínios configurados no HAProxy
⚡ Performance - Latência, throughput e stress
🛡️ Segurança - OWASP Top 10 e vulnerabilidades
🔧 Infraestrutura - HAProxy, portas, processos
📚 Documentação - Verificação de docs da API

ARQUIVOS GERADOS:
📄 basic_tests.log - Log detalhado dos testes básicos
🌐 external_tests.log - Log dos testes de endpoints externos
⚡ performance_tests.log - Log dos testes de performance  
🛡️ security_tests.log - Log dos testes de segurança
🔧 *_status.log - Logs de infraestrutura
📊 consolidated_report.html - Relatório visual consolidado
📊 *_report_*.html - Relatórios específicos por tipo

STATUS GERAL:
$(if [ "$success_rate" = "0" ] || [ $(echo "$success_rate < 70" | bc -l) -eq 1 ]; then
    echo "🚨 CRÍTICO - Taxa de sucesso muito baixa ($success_rate%)"
    echo "   • Verificar conectividade de rede"
    echo "   • Validar configurações do HAProxy"  
    echo "   • Revisar status dos serviços"
elif [ $(echo "$success_rate < 90" | bc -l) -eq 1 ]; then
    echo "⚠️ ATENÇÃO - Taxa de sucesso moderada ($success_rate%)"
    echo "   • Alguns endpoints podem estar com problemas"
    echo "   • Revisar logs para detalhes específicos"
else
    echo "✅ EXCELENTE - Taxa de sucesso alta ($success_rate%)"
    echo "   • Infraestrutura funcionando adequadamente"
    echo "   • Manter monitoramento regular"
fi)

PRÓXIMOS PASSOS:
1. 📋 Revisar logs detalhados para questões específicas
2. 🔧 Corrigir vulnerabilidades de segurança identificadas
3. 📊 Implementar monitoramento contínuo de performance
4. 🤖 Integrar testes no pipeline CI/CD
5. 📚 Manter documentação da API atualizada

================================================================
SUMMARY_EOF

    # Criar relatório HTML consolidado
    cat > "$report_file" << 'HTML_EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MockMail API - Relatório Consolidado v3.0</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6; 
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            margin-bottom: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .header h1 { 
            font-size: 3.2em; 
            margin-bottom: 15px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .header .subtitle { font-size: 1.3em; color: #666; margin-bottom: 20px; }
        .header .meta { font-size: 1em; color: #888; }
        
        .test-types-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }
        
        .test-type-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 35px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .test-type-card:hover { 
            transform: translateY(-10px); 
            box-shadow: 0 20px 50px rgba(0,0,0,0.2);
        }
        
        .test-type-icon {
            font-size: 3em;
            margin-bottom: 15px;
            display: block;
        }
        
        .test-type-title {
            font-size: 1.4em;
            font-weight: bold;
            margin-bottom: 10px;
            color: #2c3e50;
        }
        
        .test-type-metric {
            font-size: 2.2em;
            font-weight: bold;
            margin: 15px 0;
        }
        
        .test-type-description {
            color: #666;
            font-size: 0.95em;
            line-height: 1.4;
        }
        
        .metric-success { color: #27ae60; }
        .metric-warning { color: #f39c12; }
        .metric-danger { color: #e74c3c; }
        .metric-info { color: #3498db; }
        
        .overall-status {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 40px;
            border-radius: 15px;
            margin: 30px 0;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .overall-score {
            font-size: 4em;
            font-weight: bold;
            margin-bottom: 15px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 10px 25px;
            border-radius: 25px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 10px;
        }
        
        .status-excellent { background: #d5f4e6; color: #27ae60; }
        .status-good { background: #fff3e0; color: #f39c12; }
        .status-critical { background: #fadbd8; color: #e74c3c; }
        
        .section {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            margin: 30px 0;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .section h2 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 15px;
            margin-bottom: 25px;
            font-size: 2em;
        }
        
        .recommendations {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 15px;
            margin: 30px 0;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .recommendations h3 { 
            margin-bottom: 25px; 
            font-size: 1.8em;
        }
        .recommendations ul { margin-left: 25px; }
        .recommendations li { 
            margin-bottom: 12px;
            font-size: 1.1em;
        }
        
        .file-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .file-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }
        
        .footer {
            text-align: center;
            padding: 30px;
            color: rgba(255,255,255,0.8);
            margin-top: 40px;
        }
        
        @media (max-width: 768px) {
            .test-types-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 2.5em; }
            .container { padding: 15px; }
            .section, .test-type-card { padding: 25px; }
        }
        
        .progress-ring {
            width: 120px;
            height: 120px;
            margin: 20px auto;
        }
        
        .progress-ring circle {
            fill: transparent;
            stroke-width: 8;
            stroke-linecap: round;
            transform: rotate(-90deg);
            transform-origin: center;
        }
        
        .progress-background {
            stroke: #e6e6e6;
        }
        
        .progress-bar {
            stroke: #27ae60;
            stroke-dasharray: 314;
            stroke-dashoffset: calc(314 - (314 * $success_rate / 100));
            transition: stroke-dashoffset 1s ease-in-out;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 MockMail API</h1>
            <div class="subtitle">Relatório Consolidado de Testes - Versão 3.0</div>
            <div class="meta">
                <strong>Executado em:</strong> $(date)<br>
                <strong>Servidor:</strong> $BASE_URL<br>
                <strong>Hostname:</strong> $(hostname)
            </div>
        </div>
        
        <div class="overall-status">
            <div class="overall-score metric-$(if [ $(echo "$success_rate > 90" | bc -l) -eq 1 ]; then echo "success"; elif [ $(echo "$success_rate > 70" | bc -l) -eq 1 ]; then echo "warning"; else echo "danger"; fi)">$success_rate%</div>
            <h2>Taxa de Sucesso Geral</h2>
            <div class="status-badge status-$(if [ $(echo "$success_rate > 90" | bc -l) -eq 1 ]; then echo "excellent"; elif [ $(echo "$success_rate > 70" | bc -l) -eq 1 ]; then echo "good"; else echo "critical"; fi)">
                $(if [ $(echo "$success_rate > 90" | bc -l) -eq 1 ]; then echo "Excelente"; elif [ $(echo "$success_rate > 70" | bc -l) -eq 1 ]; then echo "Bom"; else echo "Crítico"; fi)
            </div>
        </div>
        
        <div class="test-types-grid">
            <div class="test-type-card">
                <div class="test-type-icon">🧪</div>
                <div class="test-type-title">Testes Básicos</div>
                <div class="test-type-metric metric-$([ $success_basic -eq $total_basic ] && echo "success" || echo "warning")">$success_basic/$total_basic</div>
                <div class="test-type-description">Endpoints fundamentais da API MockMail</div>
            </div>
            
            <div class="test-type-card">
                <div class="test-type-icon">🌐</div>
                <div class="test-type-title">Testes Externos</div>
                <div class="test-type-metric metric-$([ $success_external -eq $total_external ] && echo "success" || echo "warning")">$success_external/$total_external</div>
                <div class="test-type-description">Domínios configurados no HAProxy</div>
            </div>
            
            <div class="test-type-card">
                <div class="test-type-icon">⚡</div>
                <div class="test-type-title">Performance</div>
                <div class="test-type-metric metric-info">$total_performance</div>
                <div class="test-type-description">Requisições de latência e throughput</div>
            </div>
            
            <div class="test-type-card">
                <div class="test-type-icon">🛡️</div>
                <div class="test-type-title">Segurança</div>
                <div class="test-type-metric metric-$([ $security_issues -eq 0 ] && echo "success" || echo "warning")">$security_issues</div>
                <div class="test-type-description">Vulnerabilidades identificadas</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📊 Análise Detalhada por Tipo</h2>
            
            <h3>🧪 Testes de Funcionalidade</h3>
            <p><strong>Status:</strong> $success_basic de $total_basic endpoints testados com sucesso</p>
            <p>Verifica se todos os endpoints básicos da API estão respondendo corretamente, incluindo autenticação, processamento de emails e recuperação de dados.</p>
            
            <h3>🌐 Testes de Endpoints Externos</h3>
            <p><strong>Status:</strong> $success_external de $total_external testes externos bem-sucedidos</p>
            <p>Valida a conectividade e funcionalidade dos domínios externos configurados no HAProxy, incluindo certificados SSL e resolução DNS.</p>
            
            <h3>⚡ Testes de Performance</h3>
            <p><strong>Status:</strong> $total_performance requisições de performance executadas</p>
            <p>Mede latência, throughput e capacidade de resposta sob carga, identificando gargalos de performance.</p>
            
            <h3>🛡️ Testes de Segurança</h3>
            <p><strong>Status:</strong> $security_issues questões de segurança identificadas</p>
            <p>Avalia vulnerabilidades baseadas no OWASP Top 10, incluindo testes de injeção, autenticação e configurações de segurança.</p>
        </div>
        
        $(if [ "$success_rate" = "0" ] || [ $(echo "$success_rate < 70" | bc -l) -eq 1 ]; then
            echo "        <div class=\"recommendations\">"
            echo "            <h3>🚨 Ações Críticas Necessárias</h3>"
            echo "            <ul>"
            echo "                <li><strong>Verificar Conectividade:</strong> Problemas graves de rede ou DNS detectados</li>"
            echo "                <li><strong>Revisar HAProxy:</strong> Configuração pode estar incorreta ou serviço inativo</li>"
            echo "                <li><strong>Validar Certificados:</strong> Certificados SSL podem estar expirados ou inválidos</li>"
            echo "                <li><strong>Checar Serviços:</strong> MockMail pode estar inativo ou com problemas críticos</li>"
            echo "                <li><strong>Monitoramento 24/7:</strong> Implementar alertas imediatos para falhas</li>"
            echo "            </ul>"
            echo "        </div>"
        elif [ $(echo "$success_rate < 90" | bc -l) -eq 1 ]; then
            echo "        <div class=\"recommendations\">"
            echo "            <h3>⚠️ Melhorias Recomendadas</h3>"
            echo "            <ul>"
            echo "                <li><strong>Investigar Falhas:</strong> Alguns endpoints apresentam problemas intermitentes</li>"
            echo "                <li><strong>Otimizar Performance:</strong> Melhorar tempo de resposta e throughput</li>"
            echo "                <li><strong>Fortalecer Segurança:</strong> Corrigir vulnerabilidades identificadas</li>"
            echo "                <li><strong>Monitoramento Proativo:</strong> Implementar dashboards em tempo real</li>"
            echo "                <li><strong>Documentação:</strong> Atualizar documentação da API</li>"
            echo "            </ul>"
            echo "        </div>"
        else
            echo "        <div class=\"recommendations\">"
            echo "            <h3>🎉 Infraestrutura Excelente!</h3>"
            echo "            <ul>"
            echo "                <li><strong>Manter Qualidade:</strong> Continuar executando testes regulares</li>"
            echo "                <li><strong>Monitoramento Contínuo:</strong> Manter vigilância sobre métricas críticas</li>"
            echo "                <li><strong>CI/CD Integration:</strong> Automatizar estes testes no pipeline</li>"
            echo "                <li><strong>Expansão:</strong> Considerar testes de carga mais intensivos</li>"
            echo "                <li><strong>Benchmarking:</strong> Estabelecer métricas de referência para comparação futura</li>"
            echo "            </ul>"
            echo "        </div>"
        fi)
        
        <div class="section">
            <h2>📁 Arquivos de Resultado</h2>
            <div class="file-list">
                <div class="file-item">
                    <strong>📄</strong> consolidated_report.html - Este relatório visual
                </div>
                <div class="file-item">
                    <strong>📋</strong> test_summary.txt - Resumo executivo em texto
                </div>
                <div class="file-item">
                    <strong>🧪</strong> basic_tests.log - Log detalhado dos testes funcionais
                </div>
                <div class="file-item">
                    <strong>🌐</strong> external_tests.log - Log dos testes de endpoints externos
                </div>
                <div class="file-item">
                    <strong>⚡</strong> performance_tests.log - Métricas de performance
                </div>
                <div class="file-item">
                    <strong>🛡️</strong> security_tests.log - Relatório de segurança
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🔄 Execução Regular</h2>
            <p>Para manter a qualidade da API, recomenda-se executar esta suite de testes:</p>
            <ul>
                <li><strong>Diariamente:</strong> Testes básicos e externos para detectar problemas rapidamente</li>
                <li><strong>Semanalmente:</strong> Suite completa incluindo performance e segurança</li>
                <li><strong>Antes de Releases:</strong> Validação completa antes de novas versões</li>
                <li><strong>Pós-Incidente:</strong> Verificação após correções ou mudanças na infraestrutura</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Relatório gerado automaticamente pela Suite Completa de Testes MockMail v3.0</p>
            <p>Para análise detalhada, consulte os arquivos individuais em: <code>$RESULTS_DIR</code></p>
        </div>
    </div>
</body>
</html>
HTML_EOF

    success "✅ Relatório consolidado gerado: $report_file"
    success "✅ Resumo executivo gerado: $summary_file"
}

cleanup_old_results() {
    log "🧹 Limpando resultados antigos..."
    
    # Manter apenas os 5 últimos diretórios de resultado
    ls -dt /home/anaopcd/mockmail_test_results_* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
    
    # Limpar arquivos individuais antigos
    find /home/anaopcd -name "mockmail_*test_*.json" -mtime +7 -delete 2>/dev/null || true
    find /home/anaopcd -name "mockmail_*report_*.html" -mtime +7 -delete 2>/dev/null || true
    find /home/anaopcd -name "mockmail_*_*.log" -mtime +7 -delete 2>/dev/null || true
    
    log "✅ Limpeza concluída"
}

main() {
    local start_time=$(date +%s)
    
    log "🎬 Iniciando Suite Completa de Testes MockMail API v3.0"
    log "🆕 Nova versão inclui testes de endpoints externos do HAProxy"
    log "🏗️ Ambiente: $(uname -a)"
    
    # Setup
    setup_test_environment
    
    # Executar todos os testes em paralelo quando possível
    log "🚀 Executando bateria completa de testes..."
    
    # Testes que podem rodar em paralelo
    run_basic_tests &
    local pid_basic=$!
    
    sleep 5  # Pequena pausa para evitar conflito de recursos
    
    run_external_tests &
    local pid_external=$!
    
    sleep 5
    
    run_performance_tests &
    local pid_perf=$!
    
    sleep 5
    
    run_security_tests &
    local pid_sec=$!
    
    # Testes que precisam rodar sequencialmente
    run_infrastructure_tests
    run_api_documentation_test
    
    # Aguardar conclusão de todos os testes paralelos
    log "⏳ Aguardando conclusão de todos os testes paralelos..."
    
    wait $pid_basic
    log "✅ Testes básicos finalizados"
    
    wait $pid_external
    log "✅ Testes externos finalizados"
    
    wait $pid_perf  
    log "✅ Testes de performance finalizados"
    
    wait $pid_sec
    log "✅ Testes de segurança finalizados"
    
    # Gerar relatórios
    generate_consolidated_report
    
    # Cleanup
    cleanup_old_results
    
    # Estatísticas finais
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    log "🎉 Suite de testes v3.0 concluída com sucesso!"
    log "⏱️ Tempo total de execução: ${minutes}m ${seconds}s"
    log "📁 Resultados salvos em: $RESULTS_DIR"
    
    success "✅ Para visualizar os relatórios:"
    success "   📊 $RESULTS_DIR/consolidated_report.html (Principal)"
    success "   📄 $RESULTS_DIR/test_summary.txt (Resumo)"
    success "   🌐 $RESULTS_DIR/*external_report*.html (Endpoints externos)"
    
    log "🎯 Novidades da v3.0:"
    log "   • ✅ Testes de endpoints externos do HAProxy"
    log "   • ✅ Validação de certificados SSL automática" 
    log "   • ✅ Testes de resolução DNS"
    log "   • ✅ Monitoramento de infraestrutura aprimorado"
    log "   • ✅ Relatórios HTML mais detalhados"
    
    log "🚀 Próximos passos recomendados:"
    log "   1. 📋 Revisar relatório consolidado"
    log "   2. 🔧 Corrigir issues identificados" 
    log "   3. 🤖 Integrar no CI/CD pipeline"
    log "   4. 📊 Configurar monitoramento contínuo"
    log "   5. 📅 Agendar execução regular (cron)"
}

# Trap para cleanup em caso de interrupção
trap 'log "🛑 Suite interrompida pelo usuário"; exit 1' INT TERM

# Executar função principal
main "$@"
