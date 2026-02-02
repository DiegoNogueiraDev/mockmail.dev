#!/bin/bash

# =============================================================================
# Script de Automação para Claude Code
# =============================================================================
# Funcionalidades:
# 1. Envia Enter continuamente para a janela ativa
# 2. Monitora a existência do arquivo "fim" na raiz do projeto
# 3. Quando detecta o arquivo, inicia contador, apaga o arquivo e reinicia
#
# Uso: ./auto-claude.sh [intervalo_segundos] [timeout_apos_fim_segundos]
# Exemplo: ./auto-claude.sh 2 60  (Enter a cada 2s, reinicia 60s após detectar)
#
# Requer: xdotool, xclip
# sudo dnf install xdotool xclip  (Fedora)
# sudo apt install xdotool xclip  (Ubuntu/Debian)
#
# O prompt é lido do arquivo fix.txt na raiz do projeto
# O Claude deve criar o arquivo "fim" quando terminar
#
# Para parar: Ctrl+C
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERVALO=${1:-2}              # Intervalo entre Enters (default: 2s)
TIMEOUT_APOS_FIM=${2:-60}      # Timeout após detectar fim (default: 60s)
CONTADOR=0
TEMPO_APOS_FIM=0
FIM_DETECTADO=false
LOG_FILE="/tmp/auto-claude.log"
PROMPT_FILE="${SCRIPT_DIR}/fix.txt"
FIM_FILE_RAIZ="${SCRIPT_DIR}/fim"
FIM_FILE_GSM="${SCRIPT_DIR}/gsm-2.0/fim"

# Verificar se arquivo de prompt existe
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Erro: Arquivo $PROMPT_FILE não encontrado!"
    exit 1
fi

# Ler prompt do arquivo
PROMPT=$(cat "$PROMPT_FILE")

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

log() {
    local msg="[$(date +"%H:%M:%S")] $1"
    echo -e "$msg"
    echo "$msg" >> "$LOG_FILE"
}

# Função para verificar se o arquivo "fim" existe (raiz ou gsm-2.0/)
verificar_fim() {
    if [ -f "$FIM_FILE_RAIZ" ] || [ -f "$FIM_FILE_GSM" ]; then
        return 0
    fi
    return 1
}

# Função para apagar o arquivo "fim" (ambos os locais)
apagar_fim() {
    rm -f "$FIM_FILE_RAIZ" "$FIM_FILE_GSM"
}

# Função para enviar o prompt completo
enviar_prompt() {
    log "${YELLOW}>>> Enviando /clear...${NC}"

    # 1. Enviar /clear + Enter
    xdotool type --delay 50 "/clear"
    sleep 0.3
    xdotool key Return
    sleep 2

    log "${YELLOW}>>> Enviando prompt...${NC}"

    # 2. Copiar prompt para clipboard e colar
    echo -n "$PROMPT" | xclip -selection clipboard
    sleep 0.3

    # 3. Colar (Ctrl+V para VSCode)
    xdotool key ctrl+v
    sleep 0.5

    # 4. Enviar Enter para executar o prompt
    xdotool key Return

    log "${GREEN}>>> /clear + prompt enviados! Reiniciando ciclo...${NC}"

    # Resetar estado
    FIM_DETECTADO=false
    TEMPO_APOS_FIM=0
    CONTADOR=0
}

# Verificar dependências
check_deps() {
    local missing=""
    command -v xdotool >/dev/null 2>&1 || missing="$missing xdotool"
    command -v xclip >/dev/null 2>&1 || missing="$missing xclip"

    if [ -n "$missing" ]; then
        echo -e "${RED}Erro: Dependências faltando:$missing${NC}"
        echo "Instale com: sudo dnf install$missing"
        exit 1
    fi
}

# Main
main() {
    check_deps

    # Apagar arquivo fim anterior se existir
    apagar_fim

    echo -e "${BLUE}====================================================${NC}"
    echo -e "${BLUE}   Auto Claude - Monitoramento de arquivo 'fim'     ${NC}"
    echo -e "${BLUE}====================================================${NC}"
    echo ""
    echo -e "Intervalo entre Enters: ${GREEN}${INTERVALO}s${NC}"
    echo -e "Timeout após 'fim':     ${GREEN}${TIMEOUT_APOS_FIM}s${NC}"
    echo -e "Arquivo de prompt:      ${GREEN}${PROMPT_FILE}${NC}"
    echo -e "Arquivo de sinal:       ${GREEN}${FIM_FILE_RAIZ}${NC}"
    echo -e "                   ou:  ${GREEN}${FIM_FILE_GSM}${NC}"
    echo -e "Log:                    ${GREEN}${LOG_FILE}${NC}"
    echo ""
    echo -e "${CYAN}Modo de operação:${NC}"
    echo -e "  1. Envia Enter continuamente para a janela do VSCode"
    echo -e "  2. Monitora o arquivo ${YELLOW}'fim'${NC} na raiz ou em gsm-2.0/"
    echo -e "  3. Quando detecta, ${YELLOW}PARA${NC} os Enters e inicia contador"
    echo -e "  4. Após ${TIMEOUT_APOS_FIM}s: apaga 'fim', envia /clear + prompt + Enter"
    echo -e "  5. Volta a enviar Enter e aguarda próximo 'fim'"
    echo ""
    echo -e "${MAGENTA}O Claude deve criar o arquivo 'fim' ao terminar!${NC}"
    echo ""
    echo -e "${YELLOW}Você tem 5 segundos para focar na janela do VSCode...${NC}"
    echo ""

    for i in 5 4 3 2 1; do
        echo -ne "\r${YELLOW}Iniciando em $i...${NC}  "
        sleep 1
    done
    echo ""
    echo ""

    log "${GREEN}>>> Iniciado! Pressione Ctrl+C para parar${NC}"
    echo ""

    while true; do
        CONTADOR=$((CONTADOR + 1))
        HORA=$(date +"%H:%M:%S")

        # Verificar se arquivo "fim" existe
        if ! $FIM_DETECTADO && verificar_fim; then
            FIM_DETECTADO=true
            TEMPO_APOS_FIM=0
            echo ""
            echo ""
            log "${CYAN}>>> ARQUIVO 'fim' DETECTADO!${NC}"
            log "${CYAN}>>> Parando Enters. Iniciando contador de ${TIMEOUT_APOS_FIM}s...${NC}"
            echo ""
        fi

        # Se fim foi detectado, contar tempo (NÃO envia mais Enter)
        if $FIM_DETECTADO; then
            TEMPO_APOS_FIM=$((TEMPO_APOS_FIM + INTERVALO))

            # Barra de progresso visual
            local progress=$((TEMPO_APOS_FIM * 20 / TIMEOUT_APOS_FIM))
            local bar=""
            for ((i=0; i<20; i++)); do
                if [ $i -lt $progress ]; then
                    bar="${bar}█"
                else
                    bar="${bar}░"
                fi
            done

            echo -ne "\r[${HORA}] ${CYAN}AGUARDANDO${NC} [${bar}] ${TEMPO_APOS_FIM}s/${TIMEOUT_APOS_FIM}s    "

            # Verificar se timeout foi atingido
            if [ $TEMPO_APOS_FIM -ge $TIMEOUT_APOS_FIM ]; then
                echo ""
                echo ""
                log "${RED}>>> CONTADOR FINALIZADO!${NC}"

                # Apagar arquivo fim
                apagar_fim
                log "${YELLOW}>>> Arquivo 'fim' apagado${NC}"

                # Enviar prompt
                log "${YELLOW}>>> Executando: /clear + prompt + Enter${NC}"
                enviar_prompt

                log "${GREEN}>>> Voltando a enviar Enter continuamente...${NC}"
                echo ""
            fi
        else
            # Enviar Enter normalmente
            xdotool key Return
            echo -ne "\r[${HORA}] Enter #${CONTADOR} | Aguardando arquivo 'fim'...    "
        fi

        sleep $INTERVALO
    done
}

# Capturar Ctrl+C
cleanup() {
    echo ""
    log "${RED}>>> Script encerrado pelo usuário${NC}"
    exit 0
}
trap cleanup SIGINT

# Executar
main
