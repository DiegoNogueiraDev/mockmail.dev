# MockMail.dev - Email Temporário para Testes

Sistema completo de email temporário com API REST, dashboard de monitoramento e processamento automatizado de emails.

## 🏗️ Estrutura do Projeto

```
mockmail.dev/
├── backend/           # API Backend (Node.js/TypeScript) - porta 3000
├── frontend/          # Dashboard (Next.js 15) - porta 3001
├── email-processor/   # Processador de Emails (Node.js)
├── scripts/           # Scripts de deploy e utilitários
├── server-config/     # Configurações de servidor (Nginx, Postfix, systemd)
├── docs/              # Documentação
├── database-backup/   # Backups do MongoDB
├── deploy.sh          # Script principal de deploy
├── ecosystem.config.js # Configuração PM2
└── docker-compose.*.yml # Docker Compose por ambiente
```

## ⚡ Requisitos

- Node.js 24.x
- Docker & Docker Compose
- PM2
- Nginx
- Postfix

## 🚀 Instalação Rápida

```bash
# Clone o repositório
git clone https://github.com/DiegoNogueiraDev/mockmail.dev.git
cd mockmail.dev

# Configure o ambiente
cp .env.producao.example .env

# Suba a infraestrutura (MongoDB, Redis)
./scripts/deploy-docker.sh --env=producao

# Deploy dos serviços (API, Frontend, Processor)
./deploy.sh --env=producao
```

## 📡 Fluxo de Email

```
Postfix → email-handler.sh → FIFO → emailProcessor.ts → API → MongoDB
```

## 🔗 URLs

| Ambiente | Frontend | API |
|----------|----------|-----|
| Produção | https://mockmail.dev | https://api.mockmail.dev |
| Homologação | https://homologacao.mockmail.dev | https://api.homologacao.mockmail.dev |

## 📦 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `deploy.sh` | Deploy principal via PM2 |
| `scripts/deploy-docker.sh` | Gerencia containers Docker |
| `scripts/deploy-hot.sh` | Deploy sem downtime |
| `scripts/health-check.sh` | Verifica saúde dos serviços |
| `scripts/backup.sh` | Backup do MongoDB |

## 🛠️ Comandos Úteis

```bash
# Status dos serviços
pm2 list

# Logs em tempo real
pm2 logs

# Health check
curl https://api.mockmail.dev/api/health

# Restart serviços
pm2 restart all
```

## 📚 Documentação

- [Configuração de Ambientes](docs/CONFIGURACAO-AMBIENTES.md)
- [Breaking Changes](docs/BREAKING-CHANGES.md)
- [Segurança do Servidor](docs/SERVER-SECURITY-GUIDE.md)
- [Arquivos Críticos](docs/CRITICAL_FILES.md)

## 📄 Licença

MIT

---
🤖 Projeto desenvolvido com [Claude Code](https://claude.com/claude-code)
