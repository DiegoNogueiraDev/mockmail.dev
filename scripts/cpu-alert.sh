#!/bin/bash
CPU_THRESHOLD=80
CURRENT_CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | cut -d'.' -f1)

if [ $CURRENT_CPU -gt $CPU_THRESHOLD ]; then
    echo "[ALERTA] CPU em ${CURRENT_CPU}% às $(date)" >> ~/security-alerts.log
    ps aux --sort=-%cpu | head -10 >> ~/security-alerts.log
    echo "---" >> ~/security-alerts.log
fi
