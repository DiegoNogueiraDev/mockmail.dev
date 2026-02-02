# Comandos e Scripts

## Ambiente Local (Docker)
```bash
# Subir containers
docker compose up -d

# Importar backup MongoDB
docker exec mockmail-mongodb mongorestore --username=admin --password=mockmail_dev_2026 --authenticationDatabase=admin --archive=/backup/mongodb-backup-*.gz --gzip

# Iniciar API (dev)
cd api && npm run dev

# Iniciar Watch (dev)  
cd watch && npm run dev -- --port 3001
```

## Portas Locais
- API: http://localhost:3000
- Watch: http://localhost:3001
- MongoDB: localhost:27017
- Redis: localhost:6379
- PostgreSQL: localhost:5432

---

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
