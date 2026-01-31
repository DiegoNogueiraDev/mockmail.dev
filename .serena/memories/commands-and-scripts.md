# Comandos e Scripts

## Deploy
```bash
./deploy.sh
```

## PM2
```bash
pm2 start ecosystem.config.js
pm2 logs mockmail-api
pm2 restart all
```

## Health Check
```bash
./scripts/health-check.sh
curl http://localhost:3000/api/health
```

## Backup
```bash
./scripts/backup.sh
```

## Testes
```bash
cd api && npm test
cd watch && npm run lint
```
