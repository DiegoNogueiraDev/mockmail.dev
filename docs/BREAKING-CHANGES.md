# MockMail.dev - Breaking Changes e Guia de Migração

**Branch:** homologacao-mockmail
**Data:** 31 de Janeiro de 2026

---

## Resumo Executivo

| Categoria | Impacto |
|-----------|---------|
| Breaking Changes | 4 |
| Adições (sem impacto) | 25+ novos endpoints |
| Compatibilidade Backend | ⚠️ Parcial (ver detalhes) |

---

## 🔴 Breaking Changes

### 1. Endpoint `/api/mail/boxes-by-user` Agora Requer Autenticação

**Mudança:**
```diff
- emailRouter.get("/boxes-by-user", async (req, res, next) => {
+ emailRouter.get("/boxes-by-user", authMiddleware, async (req, res, next) => {
```

**Antes:** Endpoint público, acessível sem autenticação
**Agora:** Requer JWT válido no header `Authorization: Bearer <token>`

**Impacto:**
- ❌ Integrações que consultam estatísticas sem autenticação receberão **401 Unauthorized**
- ❌ Dashboards públicos que exibem métricas deixarão de funcionar

**Mitigação:**
```javascript
// Opção 1: Adicionar autenticação nas integrações
const response = await fetch('/api/mail/boxes-by-user', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Opção 2: Criar endpoint público específico (se necessário)
// Adicionar em email.routes.ts:
emailRouter.get("/public-stats", async (req, res) => { ... });
```

**Arquivos afetados:** `api/src/routes/email.routes.ts:33-44`

---

### 2. Validação de Senha Mais Rígida no Registro

**Mudança:**
```diff
// Antes
- password: Joi.string().min(6).required()

// Agora
+ password: Joi.string()
+   .min(12)
+   .pattern(/[A-Z]/, 'uppercase')
+   .pattern(/[a-z]/, 'lowercase')
+   .pattern(/[0-9]/, 'number')
+   .pattern(/[!@#$%^&*(),.?":{}|<>]/, 'special')
+   .required()
```

**Antes:** Mínimo 6 caracteres, sem requisitos especiais
**Agora:** Mínimo 12 caracteres + maiúscula + minúscula + número + caractere especial

**Impacto:**
- ❌ APIs de registro automatizado falharão se usarem senhas simples
- ❌ Usuários tentando se registrar com senhas antigas receberão erro 400

**Mitigação:**
```javascript
// Atualizar geração de senhas nas integrações
const senha = generateSecurePassword(12, {
  uppercase: true,
  lowercase: true,
  numbers: true,
  special: true
});
```

**Arquivos afetados:** `api/src/routes/auth.routes.ts:66-77`

---

### 3. Rate Limiting Ativado nas Rotas de Autenticação

**Mudança:**
```diff
// Antes (comentado)
- // authLimiter, // Rate limiting específico para autenticação

// Agora (ativo)
+ authLimiter, // Rate limiting específico para autenticação
```

**Configuração atual:**
```typescript
// api/src/middlewares/rateLimiter.ts
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Apenas 5 requisições por janela
  standardHeaders: true,
  legacyHeaders: false,
});
```

**Impacto:**
- ❌ Integrações automatizadas serão bloqueadas após 5 tentativas de login
- ❌ Testes automatizados falharão rapidamente
- ❌ Usuários legítimos podem ser bloqueados por erros de digitação

**Mitigação:**
```typescript
// Opção 1: Aumentar limite (recomendado)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Aumentar para 30 requisições
});

// Opção 2: Whitelist para IPs de integração
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: (req) => {
    const trustedIPs = ['10.0.0.1', '192.168.1.100'];
    return trustedIPs.includes(req.ip);
  }
});

// Opção 3: Usar Redis store para múltiplas instâncias
import RedisStore from 'rate-limit-redis';
export const authLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000,
  max: 30,
});
```

**Arquivos afetados:** `api/src/middlewares/rateLimiter.ts`, `api/src/routes/auth.routes.ts`

---

### 4. Novos Campos no Modelo User (MongoDB)

**Mudança no Schema:**
```typescript
// Campos adicionados
role: {
  type: String,
  enum: ['user', 'admin', 'system'],
  default: 'user'
},
permissions: [{
  type: String,
  enum: ['read:emails', 'write:emails', 'admin:users', 'admin:system']
}],
isActive: { type: Boolean, default: true },
lastLogin: { type: Date }
```

**Impacto:**
- ⚠️ Usuários existentes não terão os campos populados (usarão defaults do Mongoose)
- ⚠️ Queries que dependem de campos podem falhar se não usarem defaults

**Mitigação:**
```javascript
// Script de migração para popular campos em usuários existentes
// scripts/migrate-users.js
db.users.updateMany(
  { role: { $exists: false } },
  {
    $set: {
      role: 'user',
      permissions: [],
      isActive: true
    }
  }
);
```

**Arquivos afetados:** `api/src/models/User.ts`

---

## 🟢 Adições (Sem Breaking Changes)

### Novos Endpoints de Autenticação
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/auth/verify` | GET | Verifica validade do token |
| `/api/auth/me` | GET | Retorna usuário autenticado |
| `/api/auth/refresh` | POST | Renova tokens |
| `/api/auth/logout` | POST | Logout da sessão atual |
| `/api/auth/logout-all` | POST | Logout de todas sessões |

### Novos Endpoints de Email Boxes
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/boxes` | GET | Lista boxes do usuário |
| `/api/boxes` | POST | Cria novo box |
| `/api/boxes/:id` | GET | Detalhes do box |
| `/api/boxes/:id` | DELETE | Deleta box |
| `/api/boxes/:id/clear` | POST | Limpa emails do box |
| `/api/boxes/:id/emails` | GET | Lista emails do box |

### Novos Endpoints de Emails
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/mail/emails` | GET | Lista emails do usuário |
| `/api/mail/emails/:id` | GET | Detalhes do email |
| `/api/mail/emails/:id` | DELETE | Deleta email |

### Novos Recursos: Webhooks
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/webhooks` | GET | Lista webhooks |
| `/api/webhooks` | POST | Cria webhook |
| `/api/webhooks/:id` | GET/PUT/DELETE | CRUD |
| `/api/webhooks/:id/test` | POST | Testa webhook |
| `/api/webhooks/:id/deliveries` | GET | Histórico |

### Novos Recursos: API Keys
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/api-keys` | GET | Lista API keys |
| `/api/api-keys` | POST | Cria API key |
| `/api/api-keys/:id` | GET/PUT/DELETE | CRUD |
| `/api/api-keys/:id/revoke` | POST | Revoga key |

### Novos Recursos: Perfil
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/profile` | GET | Meu perfil |
| `/api/profile` | PUT | Atualiza perfil |

---

## ✅ Endpoints Sem Alteração (Compatíveis)

| Endpoint | Status |
|----------|--------|
| `POST /api/mail/process` | ✅ Mantém compatibilidade |
| `GET /api/mail/latest/:address` | ✅ Mantém compatibilidade |
| `GET /api/mail/latest/:address/subject/:subject` | ✅ Mantém compatibilidade |
| `POST /api/auth/login` | ✅ Mantém compatibilidade (com rate limit) |
| `POST /api/auth/register` | ⚠️ Validação mais rígida |

---

## 📋 Checklist de Deploy

### Antes do Deploy:
- [ ] Executar script de diagnóstico em produção: `./scripts/diagnostico-producao.sh https://api.mockmail.dev`
- [ ] Notificar integrações sobre breaking changes
- [ ] Executar migration de usuários (se necessário)
- [ ] Ajustar rate limiting conforme necessidade
- [ ] Atualizar documentação da API

### Durante o Deploy:
- [ ] Deploy em horário de baixo tráfego
- [ ] Monitorar logs para erros 401/429
- [ ] Verificar integrações críticas

### Após o Deploy:
- [ ] Validar endpoints principais
- [ ] Verificar métricas de erro
- [ ] Confirmar funcionamento de webhooks

---

## 🔧 Script de Diagnóstico

Execute para validar compatibilidade:

```bash
# Contra produção
./scripts/diagnostico-producao.sh https://api.mockmail.dev

# Contra homologação
./scripts/diagnostico-producao.sh https://api-hml.mockmail.dev

# Local
./scripts/diagnostico-producao.sh http://localhost:3000
```

---

## 📊 Matriz de Compatibilidade

| Integração | Impacto | Ação Necessária |
|------------|---------|-----------------|
| Email Processor (Python) | ✅ Nenhum | `/api/mail/process` não mudou |
| Dashboard público | 🔴 Alto | Adicionar autenticação |
| Testes automatizados | 🟠 Médio | Ajustar rate limit ou whitelist |
| APIs de registro | 🟠 Médio | Atualizar validação de senha |
| Queries MongoDB | 🟡 Baixo | Usuários usarão defaults |

---

*Documento gerado em 31/01/2026 - Branch: homologacao-mockmail*
