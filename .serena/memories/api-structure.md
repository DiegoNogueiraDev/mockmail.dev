# API Backend - Estrutura (atualizado 2026-02-10)

## Diretório: backend/src/

## Controllers
- auth.controller.ts - Login, register, logout
- mail.controller.ts - Operações de email
- emailBox.controller.ts - Gerenciamento de caixas
- webhook.controller.ts - Webhooks CRUD
- apiKey.controller.ts - API Keys CRUD
- profile.controller.ts - Perfil do usuário

## Services
- email.service.ts - CRUD emails, saveEmail(), busca
- emailBox.service.ts - CRUD boxes, findEmailBoxByAddress(), reactivateIfExpired()
- emailProcessor.service.ts - processAndPersistEmail()
- user.service.ts - Gerenciamento de usuários
- cache.service.ts - Redis cache-aside (TTLs: SHORT=60s, MEDIUM=300s, STATS=120s)
- token.service.ts - JWT tokens
- webhook.service.ts - Disparo de webhooks
- apiKey.service.ts - API keys
- emailHistory.service.ts - Histórico
- emailTracking.service.ts - Rastreamento

## Models
- Email.ts (messageId unique sparse, to+date index)
- EmailBox.ts (expiresAt TTL index)
- User.ts, UserSession.ts
- Webhook.ts, WebhookDelivery.ts
- ApiKey.ts, EmailHistory.ts

## Routes
- router.ts (principal)
- auth.routes.ts, email.routes.ts, emailBox.routes.ts
- dashboard.routes.ts, webhook.routes.ts, apiKey.routes.ts
- profile.routes.ts, admin.routes.ts, internal.routes.ts

## Middlewares
- authMiddleware.ts (JWT + API Key auth)
- rateLimiter.ts (rate limiting por IP/user)
- dailyUserLimit.ts (500 req/dia por usuário)
- csrfMiddleware.ts (proteção CSRF)
- errorHandler.ts (handler global de erros)
- roleMiddleware.ts (controle de roles)
- validateRequest.ts, validateEmailRequest.ts
- healthCheck.ts

## Validations
- email.validation.ts (schemas Joi)

## Tasks
- cleanupTask.ts (limpeza automática)

## Seeds
- seed-homologacao.ts (dados de seed para HML)

## Types
- emailTracking.ts (tipos de rastreamento)
- express.d.ts (extensões do Express types)

## Config
- env.ts, mongodb.ts, redis.ts

## Utils
- logger.ts (Winston)
- emailParser.ts (parsing de emails raw)
- sanitize.ts (sanitize-html)
- bodyParser.ts (configuração body parser)
- validateEnv.ts (validação de variáveis de ambiente)
