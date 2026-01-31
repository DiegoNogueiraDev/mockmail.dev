# Template de Task - Contexto Mínimo

## Formato de Solicitação de Task

```
TASK: [descrição curta]
MÓDULO: api | watch | email-processor | infra
TIPO: feature | bugfix | refactor | docs
ARQUIVOS PROVÁVEIS: [se souber]
```

## Checklist Pré-Task (para Claude)

1. [ ] Consultei memórias relevantes?
2. [ ] Entendi a arquitetura sem ler código?
3. [ ] Sei quais símbolos preciso modificar?
4. [ ] Tenho contexto suficiente para começar?

## Checklist Pós-Task

1. [ ] Código editado funciona?
2. [ ] Descobri algo novo para memorizar?
3. [ ] Preciso atualizar alguma memória?

## Exemplos de Tasks Bem Definidas

### ✅ BOM
```
TASK: Adicionar rate limit no endpoint /api/auth/login
MÓDULO: api
TIPO: feature
ARQUIVOS PROVÁVEIS: routes/auth.routes.ts, middlewares/rateLimiter.ts
```

### ❌ RUIM
```
Melhore a segurança da API
```

## Mapeamento Rápido Task → Memória

| Módulo | Memória Principal |
|--------|-------------------|
| api | api-structure.md |
| watch | watch-structure.md |
| infra | commands-and-scripts.md |
| geral | architecture-overview.md |
