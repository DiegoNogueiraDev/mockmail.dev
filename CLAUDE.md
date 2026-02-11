# MockMail.dev - Guia Claude Code

## O que é
Sistema de email temporário: API + Dashboard + Processador de emails.

# Memory
**OBRIGATÓRIO**: Antes de qualquer tarefa (code, debug, pesquisa, planejamento), consulte o context-hub:
1. `context_pack` com o goal da tarefa para obter contexto compacto
2. `memory_search` para buscar informações específicas já salvas
3. Memórias Serena (`read_memory`) para estrutura e arquitetura

Escopo padrão no context-hub: `mockmail`

## Estrutura
```
backend/          → API Express/TypeScript (porta 3000/3010)
frontend/         → Dashboard Next.js 15 (porta 3001/3011)
email-processor/  → Processador Node.js
scripts/          → Scripts de deploy e utilitários
server-config/    → Nginx, Postfix, systemd
docs/             → Documentação
```

## Fluxo de Email
`Postfix → email-handler.sh → FIFO → emailProcessor.ts → API → MongoDB`

## Arquivos Críticos

### Backend (backend/src/)
| Tipo | Arquivos |
|------|----------|
| Controllers | `controllers/auth.controller.ts`, `controllers/mail.controller.ts` |
| Services | `services/email.service.ts`, `services/user.service.ts` |
| Models | `models/Email.ts`, `models/EmailBox.ts`, `models/User.ts` |
| Routes | `routes/router.ts` |

### Frontend (frontend/)
| Tipo | Arquivos |
|------|----------|
| API Routes | `app/api/*/route.ts` |
| Components | `components/*.tsx` |

## Comandos Essenciais
```bash
# Infraestrutura (MongoDB, Redis)
./scripts/deploy-docker.sh --env=producao

# Serviços (API + Frontend via PM2)
./deploy.sh --env=producao

# Dev local
cd backend && npm run dev
cd frontend && npm run dev
```

## Padrões do Código
- **Validação**: Joi
- **Auth**: JWT + Bcrypt
- **Logs**: Winston
- **Sanitização**: sanitize-html

## Instruções para Claude

### Economia de Tokens
1. Use memórias Serena antes de explorar código
2. Leia símbolos específicos com `find_symbol`
3. Use `get_symbols_overview` para entender estrutura

### Regras Importantes
- Nunca abrir processos em novas portas (use 3000 e 3001)
- Não regrida funcionalidades
- Evite alterações desnecessárias no código
- não é mais facil fazer um commit git push e fazer o pull no server o repositório esta atrelado em produção
