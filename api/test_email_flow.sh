#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

API_BASE_URL="http://localhost:3000"
TEST_EMAIL="teste.flow@mockmail.dev"
TEST_SUBJECT="Teste Flow - $(date '+%H:%M:%S')"

echo -e "${BLUE}=== TESTE DE FLUXO DE EMAIL ===${NC}"

# 1. Registrar usuário
echo "1. Registrando usuário..."
REGISTER_RESULT=$(curl -s -X POST "$API_BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Teste Flow\",\"email\":\"$TEST_EMAIL\",\"password\":\"123456\"}")
echo "Registro: $REGISTER_RESULT"

# 2. Login
echo "2. Fazendo login..."
LOGIN_RESULT=$(curl -s -X POST "$API_BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"123456\"}")
echo "Login: $LOGIN_RESULT"

TOKEN=$(echo $LOGIN_RESULT | jq -r '.token')
echo "Token: ${TOKEN:0:30}..."

# 3. Enviar email
echo "3. Enviando email..."
TEMP_EMAIL=$(mktemp)
cat > "$TEMP_EMAIL" << EMAILEND
From: $TEST_EMAIL
To: testbox@mockmail.dev
Subject: $TEST_SUBJECT
Date: $(date -R)

Este é um teste de fluxo completo.
EMAILEND

sudo sendmail testbox@mockmail.dev < "$TEMP_EMAIL"
rm "$TEMP_EMAIL"
echo "Email enviado!"

# 4. Aguardar processamento
echo "4. Aguardando processamento (20s)..."
sleep 20

# 5. Verificar processamento
echo "5. Verificando se foi processado..."
if grep -q "$TEST_SUBJECT" /var/log/mockmail/emails.json; then
    echo -e "${GREEN}✅ Email processado e salvo no JSON${NC}"
else
    echo -e "${RED}❌ Email não encontrado no JSON${NC}"
fi

# 6. Verificar MongoDB
echo "6. Verificando MongoDB..."
MONGO_RESULT=$(mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
const email = db.emails.findOne({subject: '$TEST_SUBJECT'});
if (email) { 
    console.log('✅ Email encontrado no MongoDB');
    console.log('From:', email.from);
    console.log('To:', email.to);
    console.log('EmailBox:', email.emailBox);
} else {
    console.log('❌ Email não encontrado no MongoDB');
}
" 2>/dev/null)

echo "$MONGO_RESULT"

# 7. Testar API
echo "7. Testando consulta via API..."
API_RESULT=$(curl -s -X GET "$API_BASE_URL/api/mail/latest/testbox@mockmail.dev?from=$TEST_EMAIL" \
  -H "Authorization: Bearer $TOKEN")

echo "Resultado da API:"
echo "$API_RESULT" | jq '.' 2>/dev/null || echo "$API_RESULT"

if echo "$API_RESULT" | grep -q "$TEST_SUBJECT"; then
    echo -e "${GREEN}✅ SUCESSO: Email encontrado via API!${NC}"
elif echo "$API_RESULT" | grep -q "Nenhum email encontrado"; then
    echo -e "${RED}❌ PROBLEMA: 'Nenhum email encontrado nesta caixa'${NC}"
elif echo "$API_RESULT" | grep -q "não encontrada"; then
    echo -e "${RED}❌ PROBLEMA: 'Caixa não encontrada'${NC}"
else
    echo -e "${RED}❌ PROBLEMA: Resposta inesperada${NC}"
fi

echo ""
echo "=== DIAGNÓSTICO DETALHADO ==="

# Verificar usuário
echo "Usuário criado:"
mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
const user = db.users.findOne({email: '$TEST_EMAIL'});
if (user) console.log('ID:', user._id, 'Email:', user.email);
" 2>/dev/null

# Verificar emailBoxes
echo "EmailBoxes encontradas:"
mongosh "mongodb://app_user:gVYy53hBuC55@localhost:27017/mockmail?authMechanism=SCRAM-SHA-256&authSource=mockmail" --quiet --eval "
db.emailboxes.find({address: 'testbox@mockmail.dev'}).forEach(box => {
    console.log('Address:', box.address, 'UserId:', box.userId, 'ID:', box._id);
});
" 2>/dev/null

echo "Teste finalizado!"
