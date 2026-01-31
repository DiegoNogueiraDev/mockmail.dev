# MongoDB Backup - MockMail

## Informações do Backup

- **Data**: 31/01/2026 - 17:09:57 UTC
- **Formato**: Archive comprimido (gzip)
- **Banco**: MongoDB 7.0.16
- **Databases**: admin, mockmail, ct-flow-zapzap

## Estatísticas

- **mockmail.users**: 149 documentos
- **mockmail.emails**: 46 documentos
- **mockmail.emailboxes**: 9 documentos
- **admin.system.users**: 3 documentos
- **admin.system.version**: 2 documentos

## Como Restaurar

### Local (via Docker)

```bash
# Copiar backup para dentro do container
docker cp mongodb-backup-20260131-170957.gz mongodb:/tmp/

# Restaurar
docker exec mongodb mongorestore \
  --username=admin \
  --password=SUA_SENHA \
  --authenticationDatabase=admin \
  --authenticationMechanism=SCRAM-SHA-1 \
  --archive=/tmp/mongodb-backup-20260131-170957.gz \
  --gzip
```

### Local (MongoDB instalado)

```bash
mongorestore \
  --archive=mongodb-backup-20260131-170957.gz \
  --gzip
```

## Backup Criado Por

Warp Agent - Sistema de backup automatizado
