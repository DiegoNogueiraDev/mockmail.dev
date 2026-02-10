# Comandos e Scripts (atualizado 2026-02-10)

## Dev Local
```bash
cd backend && npm run dev    # API (porta 3010)
cd frontend && npm run dev   # Dashboard (porta 3011)
```

## Portas
| Serviço | Produção | Homologação |
|---------|----------|-------------|
| API | 3000 | 3010 |
| Frontend | 3001 | 3011 |
| MongoDB | 27017 | 27017 |
| Redis | 6379 | 6379 |

## Docker (Infra)
```bash
./scripts/deploy-docker.sh --env=producao     # MongoDB + Redis produção
./scripts/deploy-docker.sh --env=homologacao  # MongoDB + Redis HML
docker compose up -d                           # Local
```

## Deploy Produção (via SSH)
```bash
# Deploy completo
ssh mockmail@mockmail.dev 'cd ~/app && git pull && cd backend && npm run build && pm2 restart mockmail-api mockmail-processor --update-env'

# Ou via script local
./deploy.sh --env=producao
```

## Deploy Hot (sem downtime)
```bash
./scripts/deploy-hot.sh
```

## PM2
```bash
pm2 start ecosystem.config.js
pm2 restart mockmail-api mockmail-processor --update-env
pm2 logs mockmail-api
pm2 logs mockmail-processor
pm2 logs mockmail-frontend
```

## Health Check
```bash
curl http://localhost:3000/api/health
./scripts/health-check.sh
./scripts/system_health_monitor.sh
```

## Segurança
```bash
./scripts/security-check-repo.sh  # Verifica secrets no repo
./scripts/security-scan.sh        # Scan de segurança
```

## Backup
```bash
./scripts/backup.sh
```

## Diagnóstico
```bash
./scripts/diagnostico-producao.sh               # Diagnóstico geral
node scripts/diagnostico-box-emails.js           # Diagnóstico de boxes/emails
```

## Certificados
```bash
./scripts/gerar-certificados.sh
./scripts/gerar-secrets.sh
```

## Scripts Raiz
- deploy.sh - Deploy principal (PM2)
- ecosystem.config.js - Configuração PM2 (prod + hml + processor)
- auto-claude.sh - Automação Claude Code

## Arquivos Docker Compose
- docker-compose.yml - Local
- docker-compose.producao.yml - Produção
- docker-compose.homologacao.yml - Homologação
