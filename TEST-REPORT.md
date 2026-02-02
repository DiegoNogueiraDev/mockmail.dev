# MockMail.dev - Relatório de Testes E2E

**Data:** 31 de Janeiro de 2026
**Ferramenta:** Playwright MCP
**Ambiente:** localhost (API: 3000, Watch: 3001)

---

## Resumo Executivo

| Categoria | Status |
|-----------|--------|
| Funcionalidades Testadas | 8 |
| Funcionando | 5 |
| Bugs Encontrados | 2 |
| Avisos/Melhorias | 2 |

---

## 1. Resultados dos Testes

### ✅ Funcionalidades Funcionando

#### 1.1 Página de Login (UI)
- **Status:** ✅ Funcionando
- **Screenshot:** `test-01-login-page.png`
- **Observações:**
  - Design moderno com gradiente azul/roxo no botão
  - Campos de email e senha bem posicionados
  - Link para registro presente (porém página não existe - ver bug #1)
  - Layout responsivo

#### 1.2 Validação de Login
- **Status:** ✅ Funcionando
- **Screenshot:** `test-03-login-error.png`
- **Observações:**
  - Mensagem "User not found" exibida corretamente para usuário inexistente
  - Feedback visual adequado para erros
  - Campos mantêm valores após erro

#### 1.3 Fluxo de Autenticação
- **Status:** ✅ Funcionando
- **Screenshot:** `test-04-dashboard-success.png`
- **Observações:**
  - Login com credenciais válidas redireciona para `/admin/dashboard`
  - Cookies de sessão criados corretamente
  - Token JWT funcionando

#### 1.4 Dashboard Admin
- **Status:** ✅ Funcionando
- **Screenshot:** `test-04-dashboard-success.png`
- **Observações:**
  - Layout completo renderizado
  - Menu lateral com todas as opções visíveis
  - Cards de estatísticas presentes (Total de Caixas, Emails Recebidos, Webhooks Ativos, Chaves API)
  - Ações rápidas funcionando
  - Nota: Endpoints de dados retornam 404 (ver aviso #1)

#### 1.5 Proteção de Rotas
- **Status:** ✅ Funcionando
- **Observações:**
  - Acesso a `/` redireciona para `/login` quando não autenticado
  - Middleware de autenticação funcionando corretamente
  - Proteção aplicada a todas as rotas `/admin/*`

---

### ❌ Bugs Encontrados

#### Bug #1: Página de Registro Inexistente (404)
- **Severidade:** 🔴 Alta
- **Screenshot:** `test-02-register-404.png`
- **Descrição:** A página de registro (`/register`) retorna erro 404, porém existe um link para ela na página de login.
- **Impacto:** Novos usuários não conseguem se cadastrar pela interface web.
- **Localização:**
  - Link existe em: `watch/app/login/page.tsx`
  - Página faltando: `watch/app/register/` (diretório não existe)
- **Recomendação:** Criar a página de registro ou remover o link da página de login.

#### Bug #2: Rate Limiting Muito Restritivo
- **Severidade:** 🟠 Média
- **Screenshot:** `test-06-rate-limit-error.png`
- **Descrição:** O rate limiter de autenticação permite apenas 5 requisições a cada 15 minutos, causando bloqueio frequente durante uso normal.
- **Impacto:**
  - Usuários são bloqueados após poucas tentativas de login
  - Testes automatizados falham após algumas iterações
  - Sessão expira e usuário não consegue fazer login novamente
- **Localização:** `api/src/middlewares/rateLimiter.ts`
```typescript
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Apenas 5 requisições!
  // ...
});
```
- **Recomendação:** Aumentar o limite para pelo menos 20-30 requisições por janela de 15 minutos, ou usar janela menor (ex: 5 min).

---

### ⚠️ Avisos e Melhorias Sugeridas

#### Aviso #1: Endpoints de Dashboard Faltando
- **Severidade:** 🟡 Baixa
- **Descrição:** Os seguintes endpoints retornam 404:
  - `GET /api/dashboard/stats`
  - `GET /api/dashboard/recent-emails`
  - `GET /api/boxes`
- **Impacto:** Dashboard exibe valores zerados/default nos cards de estatísticas
- **Recomendação:** Implementar endpoints ou ajustar frontend para não requisitar dados inexistentes

#### Aviso #2: Rate Limiter em Memória
- **Descrição:** O rate limiter usa armazenamento em memória ao invés do Redis disponível.
- **Impacto:**
  - Em ambiente de produção com múltiplas instâncias, rate limit não será compartilhado
  - Reiniciar a API reseta os contadores
- **Recomendação:** Configurar `rate-limit-redis` store para usar o Redis já configurado no projeto

---

## 2. Páginas Não Testadas (Bloqueado por Rate Limit)

As seguintes páginas não puderam ser testadas completamente devido ao bloqueio por rate limiting:

| Página | Rota | Motivo |
|--------|------|--------|
| Caixas de Email | `/admin/boxes` | Sessão expirou, rate limit bloqueou re-login |
| Emails | `/admin/emails` | Idem |
| Webhooks | `/admin/webhooks` | Idem |
| Chaves API | `/admin/api-keys` | Idem |
| Perfil | `/admin/profile` | Idem |

---

## 3. Estrutura de Páginas Verificada

### Páginas Existentes (via código-fonte):

```
watch/app/
├── login/page.tsx          ✅ Testado
├── admin/
│   ├── dashboard/page.tsx  ✅ Testado
│   ├── boxes/
│   │   ├── page.tsx        ⏸️ Não testado (rate limit)
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── emails/
│   │   ├── page.tsx        ⏸️ Não testado
│   │   └── [id]/page.tsx
│   ├── webhooks/
│   │   ├── page.tsx        ⏸️ Não testado
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── api-keys/
│   │   ├── page.tsx        ⏸️ Não testado
│   │   └── new/page.tsx
│   └── profile/page.tsx    ⏸️ Não testado
├── boxes/[slug]/page.tsx   ⏸️ Não testado
└── tracking/[id]/page.tsx  ⏸️ Não testado
```

### Páginas Faltando:
- `watch/app/register/` - **BUG #1**

---

## 4. Dados de Teste Criados

Durante os testes, foi criado um usuário de teste no MongoDB:

```javascript
{
  email: "teste.playwright@mockmail.dev",
  name: "Teste Playwright",
  password: "Teste@123" // Hash bcrypt no banco
}
```

---

## 5. Screenshots Capturados

| Arquivo | Descrição |
|---------|-----------|
| `test-01-login-page.png` | Página de login inicial |
| `test-02-register-404.png` | Erro 404 na página de registro |
| `test-03-login-error.png` | Mensagem de erro "User not found" |
| `test-04-dashboard-success.png` | Dashboard após login bem-sucedido |
| `test-05-session-expired-bug.png` | Sessão expirada durante navegação |
| `test-06-rate-limit-error.png` | Erro 429 - Rate limit excedido |

---

## 6. Recomendações Prioritárias

### Prioridade Alta 🔴
1. **Criar página de registro** (`/register`) ou remover link da página de login
2. **Ajustar rate limiting** para valores mais permissivos (sugestão: 30 req/15min)

### Prioridade Média 🟠
3. **Implementar endpoints do dashboard** para exibir estatísticas reais
4. **Migrar rate limiter para Redis** para suportar múltiplas instâncias

### Prioridade Baixa 🟡
5. **Completar testes E2E** após correção do rate limiting
6. **Adicionar testes automatizados** com Playwright para CI/CD

---

## 7. Conclusão

O MockMail.dev apresenta uma base sólida com as funcionalidades principais de autenticação funcionando corretamente. A interface é moderna e responsiva. Os principais problemas identificados são:

1. **Página de registro inexistente** - impede novos cadastros
2. **Rate limiting muito restritivo** - prejudica a experiência do usuário e testes

Após a correção desses bugs, recomenda-se executar uma nova bateria de testes para validar as páginas que não puderam ser verificadas nesta sessão.

---

*Relatório gerado automaticamente via testes Playwright MCP*
