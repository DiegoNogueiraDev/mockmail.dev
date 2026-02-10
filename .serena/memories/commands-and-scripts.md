# Comandos e Scripts

## Dev Local
```bash
cd backend && npm run dev    # API (porta 3010)
cd frontend && npm run dev   # Dashboard (porta 3011)
```

## Portas
- API: 3000 (prod) / 3010 (dev)
- Frontend: 3001 (prod) / 3011 (dev)
- MongoDB: 27017 | Redis: 6379

## Docker (Infra)
```bash
./scripts/deploy-docker.sh --env=producao  # MongoDB + Redis
docker compose up -d                        # Local
```

## Deploy Produção
```bash
./deploy.sh --env=producao                  # App completa via PM2
cd backend && npm run build                 # Build backend apenas
pm2 restart mockmail-api mockmail-processor --update-env
```

## PM2
```bash
pm2 start ecosystem.config.js
pm2 logs mockmail-api
pm2 logs mockmail-processor
```

## Health Check
```bash
curl http://localhost:3000/api/health
```
