 ---                                                                                                                                                     
  Problemas que merecem correção imediata                                                                                                                 
                                                                                                                                                          
  CRITICAL                                                                                                                                                
  #: 1
  Problema: Frontend API routes sem autenticação — /api/chart-data, /api/daily-stats, /api/errors, /api/metrics leem logs do sistema e PM2 sem nenhum auth
                                                                                                                                                          
    check. Qualquer pessoa pode acessar.                                                                                                                  
  Arquivo: frontend/app/api/*/route.ts                                                                                                                    
  ────────────────────────────────────────                                                                                                                
  #: 2
  Problema: Cleanup task busca campo errado — Email.deleteMany({ to: { $nin: existingBoxAddresses } }) deveria usar o campo emailBox (ObjectId) em vez de
    to (string). Emails orfãos nunca são limpos corretamente.
  Arquivo: backend/src/tasks/cleanupTask.ts
  ────────────────────────────────────────
  #: 3
  Problema: Daily limit ignorado no email processor — incrementUserDailyUsage() retorna false quando limite excedido, mas o email já foi salvo antes. O
    resultado é apenas logado.
  Arquivo: backend/src/services/emailProcessor.service.ts:194
  HIGH
  #: 4
  Problema: Redis fail-open — Se Redis cai, rate limiting, token blacklist e daily limits são todos bypassados silenciosamente.
  Arquivo: rateLimiter.ts, token.service.ts, dailyUserLimit.ts
  ────────────────────────────────────────
  #: 5
  Problema: JWT_SECRET com default fraco — process.env.JWT_SECRET || "defaultSecret" no user.service.ts. Se o env var não for setado, todos os tokens usam

    secret conhecido.
  Arquivo: backend/src/services/user.service.ts:7
  ────────────────────────────────────────
  #: 6
  Problema: CSRF skip em login/register — CSRF protection é explicitamente pulada para /api/auth/login e /api/auth/register.
  Arquivo: backend/src/middlewares/csrfMiddleware.ts:105
  ────────────────────────────────────────
  #: 7
  Problema: Webhook retry sem error handling — setTimeout(() => deliverWebhook(...)) não faz await da Promise nem catch do erro. Se falhar, o erro é
    engolido.
  Arquivo: backend/src/services/webhook.service.ts:151
  ────────────────────────────────────────
  #: 8
  Problema: emailProcessor.ts sai em unhandledRejection — process.exit(1) no handler mata o processador inteiro. Deveria logar e continuar.
  Arquivo: backend/src/emailProcessor.ts:327
  MEDIUM
  #: 9
  Problema: Emails orfãos entre 24-48h — Cleanup só deleta emails > 48h, mas TTL do EmailBox é 24h. Janela de 24h com dados orfãos.
  Arquivo: backend/src/tasks/cleanupTask.ts
  ────────────────────────────────────────
  #: 10
  Problema: Token blacklist silenciosamente falha no logout — blacklistToken().catch(() => {}) engole erros. Token continua válido mesmo após logout.
  Arquivo: backend/src/controllers/auth.controller.ts:357
  ────────────────────────────────────────
  #: 11
  Problema: CSRF_SECRET com default hardcoded — 'mockmail-csrf-secret-change-in-production' como fallback.
  Arquivo: csrfMiddleware.ts:19
  ────────────────────────────────────────
  #: 12
  Problema: userId sem validação em admin routes — req.query.userId passado direto na query MongoDB sem validar formato ObjectId.
  Arquivo: backend/src/routes/admin.routes.ts:741
  ---
  Quer que eu priorize e corrija algum desses? Recomendo começar pelo #1 (frontend API routes expostas) e #2 (cleanup task com campo errado) — são os de
  maior impacto imediato.

✻ Cogitated for 2m 24s
