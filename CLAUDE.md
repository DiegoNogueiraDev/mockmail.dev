# MockMail.dev - Guia Claude Code

## O que é
Sistema de email temporário: API + Dashboard + Processador de emails.

## Estrutura
```
api/src/          → Backend Express/TS (porta 3000)
watch/app/        → Dashboard Next.js 15 (porta 3001)
email-processor/  → Python processor
```

## Fluxo de Email
`Postfix → email-handler.sh → FIFO → email_processor.py → API → MongoDB`

## Arquivos Críticos por Módulo

### API (api/src/)
| Tipo | Arquivos |
|------|----------|
| Controllers | `controllers/auth.controller.ts`, `controllers/mail.controller.ts` |
| Services | `services/email.service.ts`, `services/user.service.ts` |
| Models | `models/Email.ts`, `models/EmailBox.ts`, `models/User.ts` |
| Routes | `routes/router.ts` (agregador) |

### Watch (watch/)
| Tipo | Arquivos |
|------|----------|
| API Routes | `app/api/*/route.ts` |
| Components | `components/*.tsx` |

## Comandos Essenciais
```bash
# Dev
cd api && npm run dev
cd watch && npm run dev

# Build/Deploy
./deploy.sh

# Testes
cd api && npm test
```

## Padrões do Código
- **Validação**: Joi
- **Auth**: JWT + Bcrypt
- **Logs**: Winston
- **Sanitização**: sanitize-html

## Instruções para Claude

### Economia de Tokens
1. **Use memórias Serena** antes de explorar código
2. **Leia símbolos específicos** com `find_symbol` ao invés de arquivos inteiros
3. **Use `get_symbols_overview`** para entender estrutura antes de ler bodies

### Fluxo de Task
1. Consulte memórias relevantes (`list_memories` → `read_memory`)
2. Use busca simbólica para localizar código
3. Edite com `replace_symbol_body` ou `replace_content`
4. Atualize memórias se descobrir algo novo

### Memórias Disponíveis
- `architecture-overview.md` - Visão geral da arquitetura
- `api-structure.md` - Detalhes do backend
- `watch-structure.md` - Detalhes do dashboard
- `commands-and-scripts.md` - Comandos úteis
- evite regressões de funcionalidades do projeto