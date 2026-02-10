# Template de Task (atualizado 2026-02-10)

## Formato
```
TASK: [descrição curta]
MÓDULO: backend | frontend | email-processor | infra | security
TIPO: feature | bugfix | refactor | security | docs
```

## Mapeamento Módulo → Memória
| Módulo | Memória |
|--------|---------|
| backend | api-structure |
| frontend | frontend-structure |
| email-processor | architecture-overview |
| infra | commands-and-scripts |
| security | architecture-overview + api-structure |
| geral | architecture-overview |

## Checklist Pré-Edição
1. Ler memória relevante ao módulo
2. Localizar símbolos com find_symbol
3. Verificar referências com find_referencing_symbols
4. Editar com replace_symbol_body ou insert_after_symbol
5. Validar que não há regressão

## Arquivos Críticos (não editar sem necessidade)
- backend/src/server.ts (entry point)
- backend/src/emailProcessor.ts (processador de email)
- frontend/middleware.ts (auth middleware)
- ecosystem.config.js (PM2 config)
- deploy.sh (deploy script)
