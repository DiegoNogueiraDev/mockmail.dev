#!/bin/bash

# Script de Monitoramento da API MockMail
# Verifica métricas de saúde e taxa de erro

LOG_DIR="/var/log/mockmail"
SCRIPT_LOG="/tmp/mockmail_monitoring.log"
API_URL="http://localhost:3000"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "📊 MONITORAMENTO API MOCKMAIL - $(date)" | tee $SCRIPT_LOG
echo "===============================================" | tee -a $SCRIPT_LOG

# 1. Verificar se API está respondendo
echo -e "${BLUE}🔍 Verificando saúde da API...${NC}" | tee -a $SCRIPT_LOG
api_status=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health 2>/dev/null)
if [ "$api_status" = "200" ]; then
    echo -e "   ${GREEN}✅ API Online - Status: $api_status${NC}" | tee -a $SCRIPT_LOG
else
    echo -e "   ${RED}❌ API Offline - Status: $api_status${NC}" | tee -a $SCRIPT_LOG
fi

# 2. Analisar logs de erro recentes (últimas 24h)
echo -e "\n${BLUE}📈 Analisando logs dos últimos 60 minutos...${NC}" | tee -a $SCRIPT_LOG

if [ -f "$LOG_DIR/email_processor.log" ]; then
    # Contar erros 400 na última hora
    error_400_count=$(grep "$(date -d '1 hour ago' '+%Y-%m-%d %H')\|$(date '+%Y-%m-%d %H')" $LOG_DIR/email_processor.log | grep -c "400 Client Error" || echo 0)
    
    # Contar sucessos na última hora  
    success_count=$(grep "$(date -d '1 hour ago' '+%Y-%m-%d %H')\|$(date '+%Y-%m-%d %H')" $LOG_DIR/email_processor.log | grep -c "E-mail processado com sucesso" || echo 0)
    
    total_count=$((error_400_count + success_count))
    
    if [ $total_count -gt 0 ]; then
        success_rate=$((success_count * 100 / total_count))
        echo -e "   📧 Emails processados: $total_count" | tee -a $SCRIPT_LOG
        echo -e "   ✅ Sucessos: $success_count" | tee -a $SCRIPT_LOG
        echo -e "   ❌ Erros 400: $error_400_count" | tee -a $SCRIPT_LOG
        
        if [ $success_rate -ge 95 ]; then
            echo -e "   ${GREEN}🎉 Taxa de sucesso: $success_rate% (EXCELENTE!)${NC}" | tee -a $SCRIPT_LOG
        elif [ $success_rate -ge 90 ]; then
            echo -e "   ${YELLOW}⚠️  Taxa de sucesso: $success_rate% (BOM)${NC}" | tee -a $SCRIPT_LOG
        else
            echo -e "   ${RED}🚨 Taxa de sucesso: $success_rate% (CRÍTICO)${NC}" | tee -a $SCRIPT_LOG
        fi
    else
        echo -e "   ${YELLOW}ℹ️  Nenhuma atividade na última hora${NC}" | tee -a $SCRIPT_LOG
    fi
else
    echo -e "   ${YELLOW}⚠️  Log não encontrado: $LOG_DIR/email_processor.log${NC}" | tee -a $SCRIPT_LOG
fi

# 3. Verificar uso de recursos
echo -e "\n${BLUE}💻 Verificando recursos do sistema...${NC}" | tee -a $SCRIPT_LOG

# PM2 status
pm2_status=$(pm2 status mockmail-api --no-color 2>/dev/null | grep mockmail-api | awk '{print $9}')
pm2_memory=$(pm2 status mockmail-api --no-color 2>/dev/null | grep mockmail-api | awk '{print $11}')

echo -e "   🔄 Status PM2: $pm2_status" | tee -a $SCRIPT_LOG
echo -e "   🧠 Memória: $pm2_memory" | tee -a $SCRIPT_LOG

# Uso de disco na pasta de logs
if [ -d "$LOG_DIR" ]; then
    log_size=$(du -sh $LOG_DIR 2>/dev/null | cut -f1)
    echo -e "   💾 Tamanho logs: $log_size" | tee -a $SCRIPT_LOG
fi

# 4. Testar endpoint crítico
echo -e "\n${BLUE}🧪 Testando endpoint crítico...${NC}" | tee -a $SCRIPT_LOG
test_response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST -H "Content-Type: application/json" -d '{"test":"health"}' $API_URL/api/mail/process 2>/dev/null)
test_status=$(echo $test_response | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)

if [ "$test_status" = "400" ]; then
    echo -e "   ${GREEN}✅ Endpoint /process respondendo corretamente (400 esperado)${NC}" | tee -a $SCRIPT_LOG
else
    echo -e "   ${RED}❌ Endpoint /process com problemas - Status: $test_status${NC}" | tee -a $SCRIPT_LOG
fi

echo -e "\n===============================================" | tee -a $SCRIPT_LOG
echo -e "${GREEN}📊 Monitoramento concluído - $(date)${NC}" | tee -a $SCRIPT_LOG

# Salvar histórico
echo "$(date): API_Status=$api_status, Success_Rate=${success_rate:-0}%, Total_Emails=${total_count:-0}" >> /tmp/mockmail_metrics_history.log
