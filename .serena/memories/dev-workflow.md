# Fluxo de Desenvolvimento

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

## Anti-Patterns
- Ler arquivos inteiros para encontrar uma função
- Explorar código sem consultar memórias
- Repetir buscas de conversas anteriores
