#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
API_BASE_URL="http://localhost:3000"
TEST_EMAIL="teste.e2e@mockmail.dev"
TEST_PASSWORD="123456"
TEST_SUBJECT="Teste E2E - $(date '+%Y-%m-%d %H:%M:%S')"
TEST_BODY="Este é um email de teste end-to-end enviado em $(date)"

echo -e "${BLUE}=== TESTE END-TO-END DO FLUXO DE EMAIL ===${NC}"
echo -e "${BLUE}Testando: Envio → Processamento → Persistência → Consulta${NC}"
echo ""

# Função para fazer log
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Função para verificar se comando foi bem-sucedido
check_status() {
    if [ $? -eq 0 ]; then
        log_success "$1"
    else
        log_error "$1"
        exit 1
    fi
}

echo -e "${YELLOW}=== ETAPA 1: PREPARAÇÃO DO AMBIENTE ===${NC}"

# 1. Verificar se os serviços estão rodando
log "Verificando se o Postfix está rodando..."
sudo postfix status > /dev/null 2>&1
check_status "Postfix está ativo"

log "Verificando se a API está respondendo..."
curl -s "$API_BASE_URL/api/mail/process" -X POST -H "Content-Type: application/json" -d "{"test":"health"}" 2>&1 | grep -qE "(Bad Request|validation|error)"|validation"
check_status "API está respondendo"

log "Verificando se o email processor está rodando..."
pgrep -f "email_processor.py" > /dev/null
check_status "Email processor está ativo"

echo ""
echo -e "${YELLOW}=== ETAPA 2: CADASTRO/LOGIN DO USUÁRIO DE TESTE ===${NC}"

# 2. Registrar usuário de teste (ou fazer login se já existir)
log "Registrando usuário de teste: $TEST_EMAIL"
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Resposta do registro: $REGISTER_RESPONSE"

log "Fazendo login do usuário de teste..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Resposta do login: $LOGIN_RESPONSE"

# Extrair token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // empty')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    log_error "Falha ao obter token de autenticação"
    echo "Resposta completa: $LOGIN_RESPONSE"
    exit 1
fi

log_success "Token obtido com sucesso: ${TOKEN:0:20}..."

echo ""
echo -e "${YELLOW}=== ETAPA 3: ENVIO DO EMAIL VIA SENDMAIL ===${NC}"

# 3. Enviar email via sendmail (simula email real)
log "Enviando email de teste via sendmail..."

EMAIL_CONTENT="From: $TEST_EMAIL
To: teste@mockmail.dev
Subject: $TEST_SUBJECT
Date: $(date -R)
Message-ID: <test-$(date +%s)@mockmail.dev>

$TEST_BODY"

echo "$EMAIL_CONTENT" | sudo sendmail teste@mockmail.dev
check_status "Email enviado via sendmail"

echo ""
echo -e "${YELLOW}=== ETAPA 4: AGUARDANDO PROCESSAMENTO ===${NC}"

# 4. Aguardar processamento
log "Aguardando processamento do email (10 segundos)..."
sleep 10

echo ""
echo -e "${YELLOW}=== ETAPA 5: VERIFICAÇÃO DOS LOGS ===${NC}"

# 5. Verificar logs do email processor
log "Verificando logs do email processor..."
echo -e "${BLUE}Últimas 5 linhas do log:${NC}"
tail -5 /var/log/mockmail/email_processor.log

echo ""
echo -e "${BLUE}Verificando se o email foi salvo no JSON:${NC}"
if grep -q "$TEST_SUBJECT" /var/log/mockmail/emails.json; then
    log_success "Email encontrado no arquivo JSON"
else
    log_error "Email NÃO encontrado no arquivo JSON"
fi

echo ""
echo -e "${YELLOW}=== ETAPA 6: VERIFICAÇÃO NO BANCO DE DADOS ===${NC}"

# 6. Verificar no MongoDB se o email foi persistido
log "Verificando se o email foi persistido no MongoDB..."

MONGO_CHECK=$(mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
db.emails.findOne({subject: '$TEST_SUBJECT'}, {subject: 1, from: 1, to: 1, createdAt: 1})
" 2>/dev/null)

echo "Resultado da busca no MongoDB:"
echo "$MONGO_CHECK"

if echo "$MONGO_CHECK" | grep -q "$TEST_SUBJECT"; then
    log_success "Email encontrado no MongoDB"
else
    log_warning "Email NÃO encontrado no MongoDB"
fi

echo ""
echo -e "${YELLOW}=== ETAPA 7: VERIFICAÇÃO DAS CAIXAS DE EMAIL ===${NC}"

# 7. Verificar emailBoxes
log "Verificando emailBoxes criadas..."

EMAILBOX_CHECK=$(mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
db.emailboxes.find({address: 'teste@mockmail.dev'}, {address: 1, userId: 1, createdAt: 1})
" 2>/dev/null)

echo "EmailBoxes encontradas:"
echo "$EMAILBOX_CHECK"

echo ""
echo -e "${YELLOW}=== ETAPA 8: TESTE DA API DE CONSULTA ===${NC}"

# 8. Testar API de consulta
log "Testando consulta via API - Latest Email..."

LATEST_EMAIL_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/mail/latest/teste@mockmail.dev?from=$TEST_EMAIL" \
  -H "Authorization: Bearer $TOKEN")

echo "Resposta da API (latest email):"
echo "$LATEST_EMAIL_RESPONSE" | jq '.' 2>/dev/null || echo "$LATEST_EMAIL_RESPONSE"

if echo "$LATEST_EMAIL_RESPONSE" | grep -q "$TEST_SUBJECT"; then
    log_success "Email encontrado via API"
elif echo "$LATEST_EMAIL_RESPONSE" | grep -q "não encontrada"; then
    log_error "Caixa de email não encontrada"
elif echo "$LATEST_EMAIL_RESPONSE" | grep -q "Nenhum email"; then
    log_error "Nenhum email encontrado nesta caixa"
else
    log_warning "Resposta inesperada da API"
fi

echo ""
echo -e "${YELLOW}=== ETAPA 9: DIAGNÓSTICO DETALHADO ===${NC}"

# 9. Diagnóstico adicional
log "Executando diagnóstico detalhado..."

echo -e "${BLUE}Contagem total de emails no sistema:${NC}"
mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
console.log('Total de emails:', db.emails.countDocuments());
console.log('Total de emailBoxes:', db.emailboxes.countDocuments());
console.log('Total de usuários:', db.users.countDocuments());
" 2>/dev/null

echo ""
echo -e "${BLUE}Usuário de teste no sistema:${NC}"
mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
db.users.findOne({email: '$TEST_EMAIL'}, {email: 1, _id: 1})
" 2>/dev/null

echo ""
echo -e "${BLUE}EmailBoxes do usuário de teste:${NC}"
USER_ID=$(mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
const user = db.users.findOne({email: '$TEST_EMAIL'});
if(user) print(user._id); else print('null');
" 2>/dev/null | tail -1)

if [ "$USER_ID" != "null" ] && [ ! -z "$USER_ID" ]; then
    mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
    db.emailboxes.find({userId: ObjectId('$USER_ID')}, {address: 1, userId: 1, createdAt: 1})
    " 2>/dev/null
else
    echo "Usuário não encontrado ou ID inválido"
fi

echo ""
echo -e "${BLUE}=== RELATÓRIO FINAL ===${NC}"

echo -e "${GREEN}✅ Serviços verificados e funcionando${NC}"
echo -e "${GREEN}✅ Usuário de teste configurado${NC}"
echo -e "${GREEN}✅ Email enviado via sendmail${NC}"

if grep -q "$TEST_SUBJECT" /var/log/mockmail/emails.json; then
    echo -e "${GREEN}✅ Email processado e salvo no JSON${NC}"
else
    echo -e "${RED}❌ Email NÃO foi salvo no JSON${NC}"
fi

if echo "$MONGO_CHECK" | grep -q "$TEST_SUBJECT"; then
    echo -e "${GREEN}✅ Email persistido no MongoDB${NC}"
else
    echo -e "${RED}❌ Email NÃO foi persistido no MongoDB${NC}"
fi

if echo "$LATEST_EMAIL_RESPONSE" | grep -q "$TEST_SUBJECT"; then
    echo -e "${GREEN}✅ Email recuperado via API${NC}"
else
    echo -e "${RED}❌ Email NÃO foi recuperado via API${NC}"
fi

echo ""
echo -e "${BLUE}Teste concluído em $(date)${NC}"
