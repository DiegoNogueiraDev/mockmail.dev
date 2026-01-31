# API Backend - Estrutura

## Diretórios
- `controllers/` - auth.controller.ts, mail.controller.ts
- `services/` - email.service.ts, emailBox.service.ts, user.service.ts
- `models/` - Email.ts, EmailBox.ts, User.ts
- `middlewares/` - authMiddleware.ts, rateLimiter.ts, errorHandler.ts
- `routes/` - auth.routes.ts, email.routes.ts, router.ts
- `utils/` - logger.ts, emailParser.ts, sanitize.ts
- `validations/` - email.validation.ts

## Dependências Principais
Express, Mongoose, JWT, Bcrypt, Joi, Winston, sanitize-html

## Comandos
- `npm run dev` - Desenvolvimento
- `npm run build` - Build
- `npm test` - Testes
