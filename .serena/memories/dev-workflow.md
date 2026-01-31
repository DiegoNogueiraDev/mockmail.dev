# Fluxo de Desenvolvimento Otimizado

## Princípios de Economia de Tokens

### 1. Hierarquia de Consulta
```
Memórias Serena → Busca Simbólica → Leitura Parcial → Leitura Completa
```

### 2. Antes de Qualquer Task
1. `list_memories` - Ver memórias disponíveis
2. `read_memory` - Ler apenas as relevantes
3. Entender contexto SEM carregar código

### 3. Para Localizar Código
- Use `find_symbol` com `include_body=False` primeiro
- Use `get_symbols_overview` para arquivos desconhecidos
- Use `search_for_pattern` para buscas textuais
- EVITE `read_file` completo quando possível

### 4. Para Editar Código
- `replace_symbol_body` para funções/classes inteiras
- `replace_content` com regex para edições parciais
- `insert_after_symbol` / `insert_before_symbol` para novo código

### 5. Após Descobertas Importantes
- Atualize memórias existentes com `edit_memory`
- Crie novas memórias para conhecimento reutilizável

## Anti-Patterns (Evitar)
❌ Ler arquivos inteiros para encontrar uma função
❌ Ler múltiplos arquivos em sequência
❌ Explorar código sem consultar memórias primeiro
❌ Repetir buscas já feitas em conversas anteriores

## Fluxo de Nova Feature
1. Consultar memórias → Entender arquitetura
2. `find_symbol` → Localizar código relacionado
3. Planejar implementação
4. Editar com ferramentas simbólicas
5. Atualizar memórias se necessário

## Fluxo de Bug Fix
1. Consultar memórias → Entender contexto
2. `search_for_pattern` → Localizar código do bug
3. `find_symbol` com `include_body=True` → Ver implementação
4. Corrigir com `replace_content` ou `replace_symbol_body`
