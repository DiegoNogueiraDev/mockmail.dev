#!/bin/bash

# Script de Teste para Validação de Email - MockMail API
# Testa os casos que estavam falhando anteriormente

API_URL="http://localhost:3000/api/mail/process"
TEST_LOG="/tmp/mockmail_validation_test.log"
PASSED=0
FAILED=0

echo "🧪 INICIANDO TESTES DE VALIDAÇÃO DE EMAIL" > $TEST_LOG
echo "Data: $(date)" >> $TEST_LOG
echo "API: $API_URL" >> $TEST_LOG
echo "========================================" >> $TEST_LOG

# Função para testar uma requisição
test_email() {
    local test_name="$1"
    local payload="$2"
    local expected_status="$3"
    
    echo "📧 Testando: $test_name" | tee -a $TEST_LOG
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        $API_URL)
    
    status_code=$(echo $response | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo $response | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo "   ✅ PASSOU - Status: $status_code" | tee -a $TEST_LOG
        ((PASSED++))
    else
        echo "   ❌ FALHOU - Status: $status_code (esperado: $expected_status)" | tee -a $TEST_LOG
        echo "   Resposta: $body" | tee -a $TEST_LOG
        ((FAILED++))
    fi
    
    echo "" >> $TEST_LOG
    sleep 1
}

echo "🚀 Executando testes..."

# Teste 1: Email com números e pontos (caso do preprodtlffenix)
test_email "Email com números e pontos" '{
    "from": "Test User <test@example.com>",
    "to": "preprodtlffenix.q3.3055@mockmail.dev",
    "subject": "Teste de email com números",
    "body": "Corpo do email de teste"
}' "200"

# Teste 2: Email com parênteses no nome (antes rejeitado)
test_email "Email com parênteses no nome" '{
    "from": "John Doe (Manager) <john.manager@company.com>",
    "to": "user@mockmail.dev",
    "subject": "Test Subject",
    "body": "Test message"
}' "200"

# Teste 3: Assunto com dois pontos (antes rejeitado)
test_email "Assunto com dois pontos" '{
    "from": "sender@company.com",
    "to": "receiver@mockmail.dev",
    "subject": "Re: Proposta de Negócio",
    "body": "Resposta para a proposta"
}' "200"

# Teste 4: Email com vírgulas em listas (antes rejeitado)
test_email "From com vírgulas" '{
    "from": "John, Manager <john@company.com>",
    "to": "user@mockmail.dev", 
    "subject": "Test",
    "body": "Test message"
}' "200"

# Teste 5: Múltiplos pontos no username
test_email "Username com múltiplos pontos" '{
    "from": "sender@company.com",
    "to": "user.name.test.123@mockmail.dev",
    "subject": "Test",
    "body": "Test message"
}' "200"

# Teste 6: Email inválido (deve falhar)
test_email "Email inválido (deve falhar)" '{
    "from": "invalid-email",
    "to": "also-invalid",
    "subject": "Test",
    "body": "Test message"
}' "400"

# Teste 7: Caracteres perigosos (deve falhar)
test_email "Caracteres perigosos (deve falhar)" '{
    "from": "user@example.com",
    "to": "hacker<script>alert(\"xss\")</script>@evil.com",
    "subject": "Test",
    "body": "Test message"
}' "400"

# Teste 8: Campos obrigatórios faltando (deve falhar)
test_email "Campos obrigatórios faltando (deve falhar)" '{
    "from": "user@example.com"
}' "400"

echo "========================================" >> $TEST_LOG
echo "📊 RESUMO DOS TESTES:" | tee -a $TEST_LOG
echo "   ✅ Passou: $PASSED testes" | tee -a $TEST_LOG
echo "   ❌ Falhou: $FAILED testes" | tee -a $TEST_LOG

if [ $((PASSED + FAILED)) -gt 0 ]; then
    echo "   📈 Taxa de sucesso: $((PASSED * 100 / (PASSED + FAILED)))%" | tee -a $TEST_LOG
fi

echo "========================================" >> $TEST_LOG

if [ $FAILED -eq 0 ]; then
    echo "🎉 TODOS OS TESTES PASSARAM!" | tee -a $TEST_LOG
    exit 0
else
    echo "⚠️  $FAILED teste(s) falharam. Verifique o log: $TEST_LOG" | tee -a $TEST_LOG
    exit 1
fi
