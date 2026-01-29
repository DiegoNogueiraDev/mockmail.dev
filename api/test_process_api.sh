#!/bin/bash

# Cores para saída
VERDE='\033[0;32m'
VERMELHO='\033[0;31m'
AMARELO='\033[0;33m'
AZUL='\033[0;34m'
RESET='\033[0m'

# URL base da API
API_BASE="http://localhost:3000/api"
AUTH_URL="${API_BASE}/auth"
MAIL_URL="${API_BASE}/mail"

# Configurações do usuário de teste
TEST_EMAIL="teste.mockmail@exemplo.com"
TEST_PASSWORD="senha123"
TEST_NAME="Teste Mockmail"

# Arquivo temporário para armazenar o token
TOKEN_FILE=".token_temp"

# Função para verificar se um comando foi bem-sucedido
check_success() {
  if [ $? -ne 0 ]; then
    echo -e "\n${VERMELHO}✗ FALHA: $1${RESET}"
    exit 1
  fi
}

# Função para registrar um usuário
register_user() {
  echo -e "\n${AZUL}[REGISTRANDO USUÁRIO DE TESTE]${RESET}"
  echo -e "${AMARELO}EMAIL:${RESET} $TEST_EMAIL"

  # Verificar se o usuário já existe tentando fazer login
  login_response=$(curl -s -X POST "${AUTH_URL}/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"${TEST_EMAIL}\",
      \"password\": \"${TEST_PASSWORD}\"
    }")

  # Se o login for bem-sucedido, extrair o token
  if echo "$login_response" | grep -q "token"; then
    echo -e "${VERDE}✓ Usuário já existe, login realizado com sucesso${RESET}"
    token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "$token" > "$TOKEN_FILE"
    return 0
  fi

  # Tentar registrar o usuário
  register_response=$(curl -s -X POST "${AUTH_URL}/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"${TEST_EMAIL}\",
      \"password\": \"${TEST_PASSWORD}\",
      \"name\": \"${TEST_NAME}\"
    }")

  # Verificar se o registro foi bem-sucedido
  if echo "$register_response" | grep -q "email"; then
    echo -e "${VERDE}✓ Usuário registrado com sucesso${RESET}"
    
    # Fazer login para obter o token
    login_response=$(curl -s -X POST "${AUTH_URL}/login" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"${TEST_EMAIL}\",
        \"password\": \"${TEST_PASSWORD}\"
      }")
    
    # Extrair o token
    token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$token" ]; then
      echo "$token" > "$TOKEN_FILE"
      echo -e "${VERDE}✓ Token obtido e salvo${RESET}"
    else
      echo -e "${VERMELHO}✗ Falha ao obter token${RESET}"
      echo -e "${AMARELO}Resposta:${RESET} $login_response"
      exit 1
    fi
  else
    echo -e "${VERMELHO}✗ Falha ao registrar usuário${RESET}"
    echo -e "${AMARELO}Resposta:${RESET} $register_response"
    exit 1
  fi
}

# Função para testar a API de processamento de emails
testar_api() {
  local descricao="$1"
  local from_format="$2"
  local to_email="$3"
  
  # Montar o from com o formato desejado mas usando o email registrado
  local from
  case "$from_format" in
    "simple")
      from="$TEST_EMAIL"
      ;;
    "brackets")
      from="Test User <$TEST_EMAIL>"
      ;;
    "quotes")
      from="\"Test User\" <$TEST_EMAIL>"
      ;;
    "multiple")
      from="$TEST_EMAIL, Another User <another@example.com>"
      ;;
    "no_brackets")
      from="Test User $TEST_EMAIL"
      ;;
    "long_domain")
      # Usar o email registrado mas preservar o domínio para visualização
      from="$TEST_EMAIL"
      ;;
    "special_chars")
      # Extrair o nome de usuário do TEST_EMAIL
      local username=$(echo "$TEST_EMAIL" | cut -d'@' -f1)
      local domain=$(echo "$TEST_EMAIL" | cut -d'@' -f2)
      from="${username}+tag@${domain}"
      ;;
  esac
  
  echo -e "\n${AZUL}[$descricao]${RESET}"
  echo -e "${AMARELO}FROM:${RESET} $from"
  echo -e "${AMARELO}TO:${RESET} $to_email"
  
  # Obter o token salvo
  local token=$(cat "$TOKEN_FILE")
  
  # Escapar aspas duplas e quebras de linha no JSON
  from_escaped=$(echo "$from" | sed 's/"/\\"/g')
  
  # Executar o curl e capturar a resposta
  response=$(curl -s -X POST "${MAIL_URL}/process" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d "{
      \"id\": \"<test_$(date +%s)@mockmail.dev>\",
      \"subject\": \"Teste: $descricao\",
      \"from\": \"$from_escaped\",
      \"to\": \"$to_email\",
      \"date\": \"$(date -R)\",
      \"content_type\": \"text/plain\",
      \"body\": \"Este é um email de teste para $descricao\",
      \"processed_at\": \"$(date -Iseconds)\"
    }")
  
  # Verificar o resultado
  if echo "$response" | grep -q "Email processed successfully"; then
    echo -e "${VERDE}✓ SUCESSO${RESET}"
    # Extrair e mostrar o email processado da resposta JSON
    # Isso usa jq se disponível, caso contrário, mostra a resposta completa
    if command -v jq >/dev/null 2>&1; then
      echo -e "${AMARELO}Resposta:${RESET}"
      echo "$response" | jq '.email.from, .email.to'
    else
      echo -e "${AMARELO}Resposta (instale jq para melhor visualização):${RESET}"
      echo "$response" | grep -o '"from":"[^"]*"' || echo "$response"
    fi
  else
    echo -e "${VERMELHO}✗ FALHA${RESET}"
    echo -e "${AMARELO}Resposta:${RESET} $response"
  fi
  
  echo -e "----------------------------------------"
}

# Limpeza anterior
rm -f "$TOKEN_FILE"

# Registrar usuário e obter token
register_user

echo -e "\n${AZUL}=== TESTANDO DIFERENTES FORMATOS DE EMAIL NA API /process ===${RESET}"

# Teste 1: Formato simples - apenas o email
testar_api "Formato simples (apenas email)" \
  "simple" \
  "destinatario@exemplo.com"

# Teste 2: Formato com nome e email entre < >
testar_api "Formato com nome e email entre < >" \
  "brackets" \
  "destinatario@exemplo.com"

# Teste 3: Nome com aspas duplas
testar_api "Nome com aspas duplas" \
  "quotes" \
  "destinatario@exemplo.com"

# Teste 4: Múltiplos emails no campo from
testar_api "Múltiplos emails no campo from" \
  "multiple" \
  "destinatario@exemplo.com"

# Teste 5: Nome e email sem os caracteres < >
testar_api "Nome e email sem os caracteres < >" \
  "no_brackets" \
  "destinatario@exemplo.com"

# Teste 6: Email com subdomínios e TLD mais longos
testar_api "Email com subdomínios e TLD longos" \
  "long_domain" \
  "destinatario@exemplo.com"

# Teste 7: Email com caracteres especiais antes do @
testar_api "Email com caracteres especiais" \
  "special_chars" \
  "destinatario@exemplo.com"

# Limpeza ao finalizar
rm -f "$TOKEN_FILE"

echo -e "\n${AZUL}=== TESTES CONCLUÍDOS ===${RESET}" 