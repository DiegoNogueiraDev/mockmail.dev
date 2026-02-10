# Fluxo de Desenvolvimento (atualizado 2026-02-10)

## Hierarquia de Consulta (economia de tokens)
Memórias Serena → find_symbol → get_symbols_overview → search_for_pattern → leitura completa

## Para Localizar Código
1. `find_symbol` com `include_body=False` primeiro
2. `get_symbols_overview` para arquivos desconhecidos
3. `search_for_pattern` para buscas textuais
4. Evitar leitura completa de arquivos

## Para Editar Código
- `replace_symbol_body` para funções/classes inteiras
- `insert_after_symbol` / `insert_before_symbol` para novo código
- Ferramentas Edit/Write do Claude Code para edições pontuais

## Deploy
- Branch principal: `producao-mockmail`
- Fluxo: commit local → git push → ssh pull + build + pm2 restart
- NUNCA abrir processos em novas portas (usar 3000/3001 prod, 3010/3011 hml)
- NUNCA regredir funcionalidades

## Ambientes
| Ambiente | Uso | Compose |
|----------|-----|---------|
| Produção | mockmail.dev | docker-compose.producao.yml |
| Homologação | hml.mockmail.dev | docker-compose.homologacao.yml |
| Local | localhost | docker-compose.yml |

## Segurança
- Pre-commit hooks com gitleaks para detecção de secrets
- Não commitar .env, credentials ou tokens
- CSRF, rate limiting, daily limits já configurados

## Testes de Regressão
- Via Playwright MCP no browser (testado 2026-02-10, 17/17 OK)
- Cobrir: login, dashboard, criar box, enviar email, receber, visualizar, busca, webhooks, API keys, perfil, docs, excluir box, logout, registro

## Anti-Patterns
- Ler arquivos inteiros para encontrar uma função
- Explorar código sem consultar memórias
- Repetir buscas de conversas anteriores
- Fazer alterações desnecessárias no código
- Adicionar features/refactors não solicitados
