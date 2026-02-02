# MockMail - Sistema Completo de Email Temporário

Sistema completo de gestão de emails temporários com API, dashboard de monitoramento e processamento automatizado.

## Estrutura do Projeto

```
mockmail/
├── api/              # API Backend (Node.js/TypeScript)
├── watch/            # Dashboard de Monitoramento (Next.js)
├── email-processor/  # Processador de Emails (Python)
├── config/           # Configurações do sistema
├── ecosystem.config.js  # Configuração PM2
└── deploy.sh         # Script de deploy
```

## Requisitos

- Node.js 23.8.0+
- Python 3.x
- MongoDB
- Postfix
- HAProxy
- PM2

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/DiegoNogueiraDev/mockmail.dev.git /home/anaopcd/mockmail
cd /home/anaopcd/mockmail
```

2. Instale as dependências:
```bash
# API
cd api && npm install && npm run build

# Watch Dashboard
cd ../watch && npm install && npm run build
```

3. Configure as variáveis de ambiente:
```bash
# Copie e edite os arquivos .env
cp api/.env.example api/.env
cp watch/.env.local.example watch/.env.local
```

4. Inicie os serviços:
```bash
pm2 start ecosystem.config.js
pm2 save
```

## Deploy

Para fazer deploy de novas alterações:

```bash
cd /home/anaopcd/mockmail
./deploy.sh
```

## Estrutura dos Serviços

### API (Port 3000)
- Backend principal em Node.js/TypeScript
- Endpoints de autenticação e gestão de emails
- Conexão com MongoDB

### Watch Dashboard (Port 3001)
- Interface de monitoramento em Next.js
- Visualização de estatísticas em tempo real
- Gestão de caixas de email

### Email Processor
- Processa emails recebidos via Postfix
- Salva no MongoDB
- Serviço Python rodando via systemd

## Endpoints Principais

- `GET /api/health` - Status da API
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `GET /api/mail/boxes-by-user` - Estatísticas
- `GET /api/mail/latest/:address` - Último email

## Monitoramento

- PM2: `pm2 status`, `pm2 logs`
- Health: `curl http://localhost:3000/api/health`
- Dashboard: https://watch.mockmail.dev

## Manutenção

### Backup
```bash
cd /home/anaopcd/mockmail
git add -A
git commit -m "Backup $(date +%Y-%m-%d)"
git push
```

### Logs
```bash
pm2 logs mockmail-api
pm2 logs mockmail-watch
journalctl -u postfix
```

### Restart
```bash
pm2 restart all
# ou específico
pm2 restart mockmail-api
```

## Autores

- Sistema desenvolvido para gestão de emails temporários
- Co-Authored-By: Warp <agent@warp.dev>
