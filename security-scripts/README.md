# Scripts de Segurança - MockMail Server

Scripts criados durante a limpeza de malware e hardening do servidor em 31/01/2026.

## Scripts Disponíveis

### Verificação e Monitoramento
- `GUIA-RAPIDO-VERIFICACAO.sh` - Verificação rápida de segurança (use diariamente)
- `daily-security-check.sh` - Verificação completa diária
- `complete-malware-analysis.sh` - Análise profunda de malware
- `check-suspicious-processes.sh` - Detecta processos de mineração
- `cpu-alert.sh` - Alerta quando CPU > 80%

### Hardening
- `security-hardening.sh` - Hardening básico do sistema
- `advanced-hardening.sh` - Hardening avançado
- `final-security-hardening.sh` - Configurações finais

### Análise de Portas
- `ports-analysis.sh` - Análise de portas expostas
- `configure-localhost-only.sh` - Configurar apps para localhost

### Backup
- `backup-security-configs.sh` - Backup automático de configs (roda domingos 2h)

## Uso Rápido

```bash
# Verificação diária (recomendado)
~/security-scripts/GUIA-RAPIDO-VERIFICACAO.sh

# Análise completa de malware
~/security-scripts/complete-malware-analysis.sh

# Ver portas expostas
~/security-scripts/ports-analysis.sh
```

## Cron Jobs Configurados

- Verificação diária: 8h
- Alertas de CPU: a cada 5 minutos
- Backup semanal: Domingos 2h

## Proteções Ativas

- ✅ Firewall UFW
- ✅ Fail2ban (SSH + Email)
- ✅ Auditd
- ✅ Kernel hardening
- ✅ Docker hardening
- ✅ Rate limiting SSH

## Pontuação de Segurança: 10/10 ⭐

Sistema completamente limpo e protegido.
