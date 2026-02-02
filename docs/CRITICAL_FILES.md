# Arquivos Críticos Versionados - MockMail

## ✅ Código Fonte

### API Backend
- `api/src/**/*.ts` - Código TypeScript da API
- `api/package.json` - Dependências Node.js
- `api/tsconfig.json` - Configuração TypeScript
- `api/.env.example` - Template de configuração

### Watch Dashboard
- `watch/app/**/*.tsx` - Código Next.js
- `watch/components/**/*.tsx` - Componentes React
- `watch/package.json` - Dependências
- `watch/next.config.ts` - Configuração Next.js

### Email Processor
- `email-processor/email_processor.py` - Script Python principal
- `email-processor/email-handler.sh` - Script de integração Postfix
- `email-processor/requirements.txt` - Dependências Python
- `email-processor/README.md` - Documentação completa

## ⚙️ Configurações do Servidor

### HAProxy (Load Balancer)
- `server-config/haproxy/haproxy.cfg` - Configuração completa

### Postfix (Mail Server)
- `server-config/postfix/main.cf` - Configuração principal
- `server-config/postfix/master.cf` - Configuração de serviços

### MongoDB
- `server-config/mongodb/mongodb-setup.sh` - Script de setup

### Systemd Services
- `server-config/systemd/pm2-anaopcd.service` - PM2 auto-start
- `server-config/systemd/email-processor.service` - Email processor
- `server-config/systemd/mockmail-email-processor.service` - Alternativa
- `server-config/systemd/mockmail-api.service.old` - Legacy service

### Cron Jobs
- `server-config/crontab-anaopcd.txt` - Tarefas agendadas

## 🚀 Scripts de Automação

### Deploy
- `deploy.sh` - Deploy automatizado completo
- `ecosystem.config.js` - Configuração PM2

### Manutenção
- `scripts/backup.sh` - Backup completo
- `scripts/health-check.sh` - Verificação de saúde

## 📚 Documentação

- `README.md` - Documentação principal
- `SUMMARY.md` - Resumo do projeto
- `CRITICAL_FILES.md` - Este arquivo
- `server-config/INSTALLATION.md` - Guia de instalação
- `email-processor/README.md` - Setup do processador

## 🔄 Fluxo de Email

```
Postfix → email-handler.sh → FIFO → email_processor.py → API → MongoDB
```

### Componentes Envolvidos

1. **Postfix** (`/etc/postfix/main.cf`, `/etc/postfix/master.cf`)
   - Recebe emails externos
   - Chama email-handler.sh via pipe

2. **Email Handler** (`/usr/local/bin/email-handler.sh`)
   - Script bash que encaminha para FIFO
   - Versionado em: `email-processor/email-handler.sh`

3. **FIFO** (`/var/spool/email-processor`)
   - Named pipe para comunicação
   - Criado pelo email processor

4. **Email Processor** (`/opt/mockmail/email_processor.py`)
   - Lê do FIFO
   - Processa e envia para API
   - Versionado em: `email-processor/email_processor.py`

5. **API** (`http://localhost:3000`)
   - Recebe emails processados
   - Armazena no MongoDB

6. **MongoDB**
   - Armazena emails definitivamente

## 🛡️ Arquivos NÃO Versionados (Sensíveis)

- `api/.env` - Variáveis de ambiente com senhas
- `watch/.env.local` - Configurações locais
- `node_modules/` - Dependências Node.js
- `dist/`, `build/`, `.next/` - Builds compilados
- `venv/` - Ambiente virtual Python
- `*.log` - Arquivos de log
- `.pm2/` - Estado do PM2
- Certificados SSL privados

## 📊 Commits do Repositório

1. **c4c2a3d** - Initial commit (código completo)
2. **5dd5330** - Environment example e URL do repo
3. **eeda358** - Configurações do servidor
4. **7b249be** - Repository summary
5. **e7efdc0** - Email processor integration completa

## 🔐 Recuperação de Desastre

Em caso de perda total do servidor:

1. Clone o repositório
2. Siga `server-config/INSTALLATION.md`
3. Configure `.env` com senhas
4. Execute `./deploy.sh`
5. Configure certificados SSL (se necessário)

## ✅ Verificação

Todos os arquivos críticos listados aqui estão em:
**https://github.com/DiegoNogueiraDev/mockmail.dev**

Para verificar localmente:
```bash
cd ~/mockmail
git status
git log --oneline
```
