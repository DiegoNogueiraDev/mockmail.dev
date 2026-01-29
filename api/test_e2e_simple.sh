#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
API_BASE_URL="http://localhost:3000"
TEST_EMAIL="teste.e2e@mockmail.dev"
TEST_PASSWORD="123456"
TEST_SUBJECT="Teste E2E - $(date '+%Y-%m-%d %H:%M:%S')"
TEST_BODY="Este é um email de teste end-to-end enviado em $(date)"

echo -e "${BLUE}=== TESTE END-TO-END DO FLUXO DE EMAIL ===${NC}"
echo ""

# Função para fazer log
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo -e "${YELLOW}=== ETAPA 1: VERIFICAÇÃO DOS SERVIÇOS ===${NC}"

# Verificar Postfix
if sudo postfix status > /dev/null 2>&1; then
    log_success "Postfix está ativo"
else
    log_error "Postfix não está ativo"
    exit 1
fi

# Verificar API
if curl -s "$API_BASE_URL/api/mail/process" -X POST -H "Content-Type: application/json" -d '{"test":"health"}' | grep -q "Erro de validação"; then
    log_success "API está respondendo"
else
    log_error "API não está respondendo corretamente"
    exit 1
fi

# Verificar Email Processor
if pgrep -f "email_processor.py" > /dev/null; then
    log_success "Email processor está ativo"
else
    log_error "Email processor não está ativo"
    exit 1
fi

echo ""
echo -e "${YELLOW}=== ETAPA 2: REGISTRO/LOGIN DO USUÁRIO ===${NC}"

# Registrar usuário
log_info "Registrando usuário: $TEST_EMAIL"
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Usuario Teste\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Registro: $REGISTER_RESPONSE"

# Login
log_info "Fazendo login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Usuario Teste\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Login: $LOGIN_RESPONSE"

# Extrair token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // empty')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    log_error "Falha ao obter token"
    exit 1
fi

log_success "Token obtido: ${TOKEN:0:20}..."

echo ""
echo -e "${YELLOW}=== ETAPA 3: ENVIO DO EMAIL ===${NC}"

# Criar arquivo temporário para o email
TEMP_EMAIL=$(mktemp)
cat > "$TEMP_EMAIL" << EMAILEOF
From: $TEST_EMAIL
To: teste@mockmail.dev
Subject: $TEST_SUBJECT
Date: $(date -R)
Message-ID: <test-$(date +%s)@mockmail.dev>

$TEST_BODY
EMAILEOF

log_info "Enviando email via sendmail..."
sudo sendmail teste@mockmail.dev < "$TEMP_EMAIL"
rm "$TEMP_EMAIL"

if [ $? -eq 0 ]; then
    log_success "Email enviado via sendmail"
else
    log_error "Falha ao enviar email"
    exit 1
fi

echo ""
echo -e "${YELLOW}=== ETAPA 4: AGUARDANDO PROCESSAMENTO ===${NC}"

log_info "Aguardando processamento (15 segundos)..."
sleep 15

echo ""
echo -e "${YELLOW}=== ETAPA 5: VERIFICAÇÃO DOS LOGS ===${NC}"

log_info "Verificando logs do email processor..."
echo "Últimas linhas do log:"
tail -3 /var/log/mockmail/email_processor.log

if grep -q "$TEST_SUBJECT" /var/log/mockmail/emails.json; then
    log_success "Email encontrado no arquivo JSON"
else
    log_error "Email NÃO encontrado no arquivo JSON"
fi

echo ""
echo -e "${YELLOW}=== ETAPA 6: VERIFICAÇÃO NO BANCO DE DADOS ===${NC}"

log_info "Verificando MongoDB..."
MONGO_RESULT=$(mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
const email = db.emails.findOne({subject: '$TEST_SUBJECT'});
if (email) { 
    console.log('ENCONTRADO:', email.subject, 'de', email.from, 'para', email.to);
} else {
    console.log('NÃO_ENCONTRADO');
}
" 2>/dev/null)

echo "MongoDB: $MONGO_RESULT"

echo ""
echo -e "${YELLOW}=== ETAPA 7: TESTE DA API DE CONSULTA ===${NC}"

log_info "Consultando último email via API..."
API_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/mail/latest/teste@mockmail.dev?from=$TEST_EMAIL" \
  -H "Authorization: Bearer $TOKEN")

echo "Resposta da API:"
echo "$API_RESPONSE" | jq '.' 2>/dev/null || echo "$API_RESPONSE"

if echo "$API_RESPONSE" | grep -q "$TEST_SUBJECT"; then
    log_success "Email encontrado via API!"
elif echo "$API_RESPONSE" | grep -q "não encontrada"; then
    log_error "Caixa de email não encontrada"
elif echo "$API_RESPONSE" | grep -q "Nenhum email"; then
    log_error "Nenhum email encontrado nesta caixa"
else
    log_error "Resposta inesperada da API"
fi

echo ""
echo -e "${YELLOW}=== DIAGNÓSTICO ADICIONAL ===${NC}"

log_info "Informações do usuário e emailBox..."

# Buscar ID do usuário
USER_ID=$(mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
const user = db.users.findOne({email: '$TEST_EMAIL'});
if(user) console.log(user._id); else console.log('null');
" 2>/dev/null | tail -1)

echo "User ID: $USER_ID"

# Buscar emailBoxes
EMAILBOX_INFO=$(mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
db.emailboxes.find({address: 'teste@mockmail.dev'}).forEach(box => {
    console.log('EmailBox:', box.address, 'User:', box.userId, 'ID:', box._id);
});
" 2>/dev/null)

echo "EmailBoxes: $EMAILBOX_INFO"

echo ""
echo -e "${BLUE}=== RELATÓRIO FINAL ===${NC}"
echo "Teste concluído em $(date)"
