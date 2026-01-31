# MockMail.dev - Arquitetura

## Stack
- **API**: Node.js/Express/TypeScript (porta 3000)
- **Dashboard**: Next.js 15 + React 19 + Tailwind (porta 3001)
- **Email Processor**: Python (via systemd)
- **DB**: MongoDB (Mongoose)
- **Infra**: PM2, HAProxy, Postfix

## Estrutura Principal
```
api/src/          → Backend TypeScript
watch/app/        → Frontend Next.js
email-processor/  → Python processor
server-config/    → Configs de servidor
```

## Fluxo de Email
Postfix → email-handler.sh → FIFO → email_processor.py → API → MongoDB

## Endpoints Críticos
- `GET /api/health` - Status
- `POST /api/auth/login|register` - Auth
- `GET /api/mail/boxes-by-user` - Stats
- `GET /api/mail/latest/:address` - Último email
