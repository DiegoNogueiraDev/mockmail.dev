# MockMail.dev - Arquitetura

## Stack
- **API**: Node.js/Express/TypeScript (porta 3000 prod, 3010 dev)
- **Frontend**: Next.js 15 + React 19 + Tailwind v4 (porta 3001 prod, 3011 dev)
- **Email Processor**: TypeScript standalone (backend/src/emailProcessor.ts, via PM2)
- **DB**: MongoDB (Mongoose) + Redis (cache)
- **Infra**: PM2, Nginx, Postfix, Docker (MongoDB + Redis)

## Estrutura
```
backend/src/        → API Express/TypeScript
frontend/           → Dashboard Next.js 15
email-processor/    → Legacy Python (DESATIVADO)
server-config/      → Nginx, Postfix, systemd
scripts/            → Deploy e utilitários
```

## Fluxo de Email
Postfix → email-handler.sh → FIFO → emailProcessor.ts → HTTP POST → API → MongoDB

## Pontos de Entrada
- `backend/src/server.ts` → Servidor Express
- `backend/src/emailProcessor.ts` → Processador standalone
- `frontend/app/layout.tsx` → Root layout Next.js

## Deduplicação
- Campo `messageId` no Email model com unique sparse index
- Check de duplicata em `saveEmail()` antes de salvar

## Reativação de Box Expirada
- `reactivateIfExpired()` em `processAndPersistEmail()`
- Estende expiresAt em 24h quando email chega para box expirada
