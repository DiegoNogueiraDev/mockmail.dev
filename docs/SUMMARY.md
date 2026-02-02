# MockMail - Resumo do Repositório

## 📦 Conteúdo do Repositório

### Código Fonte
- **api/**: Backend API completo em Node.js/TypeScript
- **watch/**: Dashboard de monitoramento em Next.js
- **email-processor/**: Processador de emails em Python

### Configurações do Servidor
- **server-config/haproxy/**: Configuração do load balancer
- **server-config/postfix/**: Configuração do servidor de email
- **server-config/mongodb/**: Scripts de setup do banco de dados
- **server-config/systemd/**: Serviços systemd (PM2, email-processor)

### Scripts de Manutenção
- **scripts/backup.sh**: Backup completo do sistema
- **scripts/health-check.sh**: Monitoramento de saúde dos serviços
- **deploy.sh**: Script de deploy automatizado

### Documentação
- **README.md**: Documentação principal do projeto
- **server-config/INSTALLATION.md**: Guia completo de instalação
- **api/.env.example**: Template de configuração

## 🚀 Quick Start

```bash
# Clonar repositório
git clone https://github.com/DiegoNogueiraDev/mockmail.dev.git ~/mockmail
cd ~/mockmail

# Instalar dependências
cd api && npm install && npm run build
cd ../watch && npm install && npm run build

# Iniciar serviços
pm2 start ecosystem.config.js
pm2 save
```

## 🔧 Comandos Principais

```bash
# Deploy
./deploy.sh

# Health Check
./scripts/health-check.sh

# Backup
./scripts/backup.sh

# Ver logs
pm2 logs
```

## 📊 Commits Realizados

1. **c4c2a3d** - Initial commit com código completo
2. **5dd5330** - Adicionado .env.example e URL do repo
3. **eeda358** - Configurações do servidor e scripts de manutenção

## 🌐 URLs

- **Repositório**: https://github.com/DiegoNogueiraDev/mockmail.dev
- **API**: http://localhost:3000/api/health
- **Dashboard**: https://watch.mockmail.dev

## 📝 Arquivos Críticos Versionados

✅ Código fonte completo (API, Watch, Email Processor)
✅ Configurações HAProxy
✅ Configurações Postfix
✅ Configurações MongoDB
✅ Serviços Systemd
✅ Scripts PM2
✅ Scripts de backup e manutenção
✅ Documentação completa
