# API Backend - Estrutura

## Diretórios
- `controllers/` - auth.controller.ts, mail.controller.ts, emailBox.controller.ts, webhook.controller.ts, apiKey.controller.ts
- `services/` - email.service.ts, emailBox.service.ts, user.service.ts, cache.service.ts, token.service.ts
- `models/` - Email.ts, EmailBox.ts, User.ts, Webhook.ts, ApiKey.ts
- `middlewares/` - authMiddleware.ts, rateLimiter.ts, errorHandler.ts
- `routes/` - auth.routes.ts, email.routes.ts, dashboard.routes.ts, webhook.routes.ts, apiKey.routes.ts, router.ts
- `utils/` - logger.ts, emailParser.ts, sanitize.ts
- `config/` - redis.ts, mongo.ts, prisma.ts
- `validations/` - email.validation.ts

## Cache Redis (cache.service.ts)
O serviço de cache implementa o padrão cache-aside com TTLs estratégicos:
- **TTL.SHORT** (60s): Dados que mudam frequentemente (lista de emails)
- **TTL.MEDIUM** (300s): Dados moderados (lista de boxes, webhooks, api-keys)
- **TTL.STATS** (120s): Estatísticas do dashboard

### Rotas com Cache
- `GET /boxes` - Lista de caixas de email do usuário
- `GET /emails` - Lista de emails do usuário
- `GET /webhooks` - Lista de webhooks do usuário
- `GET /api-keys` - Lista de API keys do usuário

### Invalidação Automática
Cache é invalidado automaticamente em operações de escrita (create, update, delete)

## Dependências Principais
Express, Mongoose, JWT, Bcrypt, Joi, Winston, sanitize-html, Redis

## Comandos
- `npm run dev` - Desenvolvimento
- `npm run build` - Build
- `npm test` - Testes
