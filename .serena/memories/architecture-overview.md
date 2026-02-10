# MockMail.dev - Arquitetura (atualizado 2026-02-10)

## Stack
- **API**: Node.js/Express/TypeScript (porta 3000 prod, 3010 hml)
- **Frontend**: Next.js 15 + React 19 + Tailwind v4 (porta 3001 prod, 3011 hml)
- **Email Processor**: TypeScript standalone (backend/src/emailProcessor.ts, via PM2)
- **DB**: MongoDB (Mongoose) + Redis (cache)
- **Infra**: PM2, Nginx, Postfix, Docker (MongoDB + Redis)
- **Segurança**: gitleaks, pre-commit hooks, CSRF middleware, rate limiting, daily user limits

## Estrutura
```
backend/src/        → API Express/TypeScript
frontend/           → Dashboard Next.js 15
email-processor/    → Legacy Python (DESATIVADO)
server-config/      → Nginx, Postfix, systemd, MongoDB setup
scripts/            → Deploy, backup, diagnóstico, segurança, health checks
docs/               → SECURITY, SERVER-SECURITY-GUIDE, BREAKING-CHANGES, CONFIG-AMBIENTES, etc.
```

## Ambientes
| Ambiente | API | Frontend | Docker Compose |
|----------|-----|----------|----------------|
| Produção | :3000 | :3001 | docker-compose.producao.yml |
| Homologação | :3010 | :3011 | docker-compose.homologacao.yml |

## PM2 Processos
| Processo | Descrição |
|----------|-----------|
| mockmail-api | API produção (:3000) |
| mockmail-frontend | Frontend produção (:3001) |
| mockmail-api-hml | API homologação (:3010) |
| mockmail-frontend-hml | Frontend homologação (:3011) |
| mockmail-processor | Email processor (único, distribui para HML e PROD) |

## Fluxo de Email
Postfix → email-handler.sh → FIFO → emailProcessor.ts → HTTP POST → API → MongoDB

## Pontos de Entrada
- `backend/src/server.ts` → Servidor Express
- `backend/src/emailProcessor.ts` → Processador standalone (multi-ambiente)
- `frontend/app/layout.tsx` → Root layout Next.js
- `frontend/middleware.ts` → Next.js middleware (auth, rotas públicas/protegidas)

## Deduplicação
- Campo `messageId` no Email model com unique sparse index
- Check de duplicata em `saveEmail()` antes de salvar

## Reativação de Box Expirada
- `reactivateIfExpired()` em `processAndPersistEmail()`
- Estende expiresAt em 24h quando email chega para box expirada

## Segurança
- `.gitleaks.toml` + `.secrets.baseline` para detecção de secrets
- `.pre-commit-config.yaml` para hooks de segurança
- CSRF middleware, rate limiter, daily user limits no backend
- Helmet com CSP configurado
