# Configuração de Ambientes - MockMail.dev

## 📋 Visão Geral

Este guia explica como configurar os ambientes de **Homologação** e **Produção** do MockMail.dev.

## 🌐 URLs dos Ambientes

### Homologação
- **Frontend**: https://homologacao.mockmail.dev
- **API**: https://api.homologacao.mockmail.dev

### Produção
- **Frontend**: https://mockmail.dev
- **API**: https://api.mockmail.dev

## 📁 Estrutura de Arquivos

```
mockmail.dev/
├── .env.homologacao           # Variáveis raiz (homologação)
├── .env.producao              # Variáveis raiz (produção)
├── backend/
│   ├── .env.homologacao       # Backend (homologação)
│   └── .env.producao          # Backend (produção)
└── frontend/
    ├── .env.homologacao       # Frontend (homologação)
    └── .env.producao          # Frontend (produção)
```

## 🔐 Passo 1: Gerar Senhas e Secrets

### Para Homologação

```bash
# Gerar senhas para bancos de dados (32 caracteres)
echo "MONGO_PASSWORD_HML=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD_HML=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD_HML=$(openssl rand -base64 32)"

# Gerar secrets JWT (64 caracteres - mais seguro)
echo "JWT_SECRET_HML=$(openssl rand -base64 64)"
echo "JWT_REFRESH_SECRET_HML=$(openssl rand -base64 64)"

# Gerar secret CSRF (32 caracteres)
echo "CSRF_SECRET_HML=$(openssl rand -base64 32)"
```

### Para Produção

```bash
# Gerar senhas para bancos de dados (32 caracteres)
echo "MONGO_PASSWORD_PROD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD_PROD=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD_PROD=$(openssl rand -base64 32)"

# Gerar secrets JWT (64 caracteres - CRÍTICO!)
echo "JWT_SECRET_PROD=$(openssl rand -base64 64)"
echo "JWT_REFRESH_SECRET_PROD=$(openssl rand -base64 64)"

# Gerar secret CSRF (32 caracteres)
echo "CSRF_SECRET_PROD=$(openssl rand -base64 32)"
```

## 📝 Passo 2: Configurar os Arquivos

### Homologação

1. **Edite `.env.homologacao`** na raiz do projeto
2. **Edite `backend/.env.homologacao`**
3. **NÃO precisa editar** `frontend/.env.homologacao` (já está configurado)

Substitua os valores:
- `SUBSTITUA_POR_SENHA_SEGURA_MONGODB_HML` → Use a senha gerada
- `SUBSTITUA_POR_SENHA_SEGURA_REDIS_HML` → Use a senha gerada
- `SUBSTITUA_POR_SENHA_SEGURA_POSTGRES_HML` → Use a senha gerada
- `SUBSTITUA_POR_CHAVE_JWT_MUITO_SEGURA_HML_64_CARACTERES` → Use o secret gerado
- `SUBSTITUA_POR_CHAVE_REFRESH_MUITO_SEGURA_HML_64_CARACTERES` → Use o secret gerado
- `SUBSTITUA_POR_CHAVE_CSRF_SEGURA_HML` → Use o secret gerado

### Produção

1. **Edite `.env.producao`** na raiz do projeto
2. **Edite `backend/.env.producao`**
3. **NÃO precisa editar** `frontend/.env.producao` (já está configurado)

Substitua os valores:
- `SUBSTITUA_POR_SENHA_MUITO_SEGURA_MONGODB_PROD` → Use a senha gerada
- `SUBSTITUA_POR_SENHA_MUITO_SEGURA_REDIS_PROD` → Use a senha gerada
- `SUBSTITUA_POR_SENHA_MUITO_SEGURA_POSTGRES_PROD` → Use a senha gerada
- `SUBSTITUA_POR_CHAVE_JWT_MUITO_SEGURA_PRODUCAO_64_CARACTERES_MINIMO` → Use o secret gerado
- `SUBSTITUA_POR_CHAVE_REFRESH_MUITO_SEGURA_PRODUCAO_64_CARACTERES_MINIMO` → Use o secret gerado
- `SUBSTITUA_POR_CHAVE_CSRF_MUITO_SEGURA_PRODUCAO` → Use o secret gerado

## 🚀 Passo 3: Deploy

### Deploy de Homologação

```bash
# Garantir que está usando o arquivo correto
export ENV_FILE=.env.homologacao

# Executar deploy
./deploy.sh homologacao
```

### Deploy de Produção

```bash
# Garantir que está usando o arquivo correto
export ENV_FILE=.env.producao

# Executar deploy
./deploy.sh producao
```

## ⚠️ Checklist de Segurança

### Antes de fazer deploy:

- [ ] Todas as senhas foram substituídas por valores únicos e seguros
- [ ] Os secrets JWT têm pelo menos 64 caracteres
- [ ] O arquivo `.env.producao` NÃO está commitado no git
- [ ] As URLs estão corretas para cada ambiente
- [ ] `LOG_LEVEL=info` em produção (não use `debug`)
- [ ] `COOKIE_SECURE=true` em ambos os ambientes
- [ ] `COOKIE_SAME_SITE=strict` em produção
- [ ] `NODE_ENV=production` em ambos os ambientes

### Após o deploy:

- [ ] Teste a autenticação
- [ ] Verifique os logs para erros
- [ ] Confirme que os cookies estão sendo configurados corretamente
- [ ] Teste o CORS entre frontend e backend
- [ ] Verifique se o rate limiting está funcionando

## 🔒 Boas Práticas de Segurança

1. **NUNCA commite arquivos `.env` no git**
   - Os arquivos `.env.*` devem estar no `.gitignore`
   - Apenas os `.env.*.example` devem estar no repositório

2. **Use um gerenciador de segredos**
   - Em produção, considere usar Vault, AWS Secrets Manager, etc.
   - Evite armazenar secrets em arquivos de texto plano

3. **Rotacione secrets regularmente**
   - Mude os secrets JWT a cada 3-6 meses
   - Mude senhas de banco após qualquer incidente

4. **Mantenha backups seguros**
   - Faça backup dos secrets em um local seguro
   - Use criptografia para armazenar backups

5. **Controle de acesso**
   - Apenas administradores devem ter acesso aos arquivos `.env`
   - Use permissões restritas: `chmod 600 .env*`

## 📊 Diferenças entre Ambientes

| Configuração | Homologação | Produção |
|--------------|-------------|----------|
| LOG_LEVEL | `debug` | `info` |
| COOKIE_SAME_SITE | `lax` | `strict` |
| PORT (backend) | `3010` | `3000` |
| Database | `mockmail_hml` | `mockmail` |

## 🆘 Troubleshooting

### Erro de CORS
- Verifique se `ALLOWED_ORIGINS` está correto
- Confirme que `CORS_ORIGIN` aponta para o domínio correto

### Erro de autenticação
- Verifique se os secrets JWT são os mesmos no `.env` raiz e no `backend/.env`
- Confirme que `JWT_SECRET` tem pelo menos 64 caracteres

### Cookies não estão sendo salvos
- Verifique `COOKIE_DOMAIN`
- Confirme que `COOKIE_SECURE=true` e você está usando HTTPS
- Em homologação, pode usar `COOKIE_SAME_SITE=lax` para facilitar testes

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs: `docker-compose logs -f`
2. Revise este guia
3. Consulte a documentação do projeto
