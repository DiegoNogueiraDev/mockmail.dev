# MockMail Dashboard

Dashboard de monitoramento em tempo real para o sistema MockMail, construído com Next.js, TypeScript e TailwindCSS.

## 📊 Recursos

- **Métricas em Tempo Real**: Monitoramento de emails processados, taxa de erro, usuários ativos e uptime do sistema
- **Visualizações Interativas**: Gráficos das últimas 24 horas usando Recharts
- **Status do Sistema**: Monitoramento de API, processador de emails, MongoDB e HAProxy
- **Log de Erros**: Visualização de erros recentes com classificação por tipo e severidade
- **Atualizações Automáticas**: Dados atualizados automaticamente a cada 30-60 segundos

## 🚀 Deployment com PM2

### Pré-requisitos

- Node.js (versão 18 ou superior)
- PM2 instalado globalmente: `npm install -g pm2`
- Acesso ao sistema MockMail em execução

### Deploy Automático

Execute o script de deployment:

```bash
./deploy.sh
```

O script irá:
1. Fazer build da aplicação
2. Parar processos PM2 existentes
3. Iniciar o dashboard com PM2
4. Salvar a configuração do PM2

### Deploy Manual

Se preferir fazer o deploy manualmente:

```bash
# Build da aplicação
npm run build

# Iniciar com PM2
pm2 start ecosystem.config.js

# Salvar configuração
pm2 save
```

## 🔧 Configuração do HAProxy

### 1. Adicionar Backend

Adicione esta configuração ao seu arquivo `/etc/haproxy/haproxy.cfg`:

```haproxy
# Backend para o dashboard
backend mockmail-dashboard
    balance roundrobin
    option httpchk GET /api/metrics
    server dashboard1 127.0.0.1:3001 check
```

### 2. Configurar Frontend

#### Opção A: Adicionar ao frontend existente

```haproxy
frontend main
    # ... suas configurações existentes ...
    
    # Dashboard MockMail
    acl is_watch_domain hdr(host) -i watch.mockmail.dev
    use_backend mockmail-dashboard if is_watch_domain
```

#### Opção B: Frontend dedicado

```haproxy
frontend mockmail-watch-frontend
    bind *:80
    bind *:443 ssl crt /path/to/ssl/certificate.pem
    
    # Redirect HTTP to HTTPS
    redirect scheme https if !{ ssl_fc }
    
    # Security headers
    http-response set-header X-Frame-Options SAMEORIGIN
    http-response set-header X-XSS-Protection "1; mode=block"
    http-response set-header X-Content-Type-Options nosniff
    
    # Check if it's the dashboard domain
    acl is_watch_domain hdr(host) -i watch.mockmail.dev
    use_backend mockmail-dashboard if is_watch_domain
    
    # Default backend
    default_backend mockmail-api
```

### 3. Recarregar HAProxy

```bash
sudo systemctl reload haproxy
```

## 📝 Comandos úteis do PM2

```bash
# Ver logs do dashboard
pm2 logs mockmail-watch

# Reiniciar dashboard
pm2 restart mockmail-watch

# Parar dashboard
pm2 stop mockmail-watch

# Status de todos os processos
pm2 status

# Monitorar recursos em tempo real
pm2 monit
```

## 🌐 Acesso ao Dashboard

- **Local**: http://localhost:3001
- **Produção**: https://watch.mockmail.dev (após configurar HAProxy e DNS)

## 📊 APIs Disponíveis

O dashboard expõe três endpoints de API:

### `/api/metrics`
Retorna métricas gerais do sistema:
```json
{
  "emailsProcessed": 8170,
  "emailsPerHour": 12,
  "errorRate": 10.2,
  "uptime": "2d 14h 30m",
  "activeUsers": 145,
  "totalEmailBoxes": 234,
  "systemStatus": "online",
  "lastUpdate": "2025-08-25T18:00:00.000Z",
  "pm2Status": {...}
}
```

### `/api/errors`
Retorna erros recentes do sistema:
```json
{
  "errors": [...],
  "summary": {
    "total": 11,
    "byType": {
      "error": 8,
      "warning": 2,
      "critical": 1
    }
  },
  "lastUpdate": "2025-08-25T18:00:00.000Z"
}
```

### `/api/chart-data`
Retorna dados para o gráfico das últimas 24 horas:
```json
{
  "data": [...],
  "summary": {
    "totalSuccess": 234,
    "totalErrors": 23,
    "totalEmails": 257,
    "successRate": 91
  },
  "lastUpdate": "2025-08-25T18:00:00.000Z"
}
```

## 🔒 Segurança

O dashboard atualmente roda sem autenticação. Para ambientes de produção, considere:

1. **Configurar HAProxy com autenticação básica**
2. **Implementar autenticação JWT no dashboard**
3. **Configurar firewall para restringir acesso à porta 3001**
4. **Usar HTTPS com certificados válidos**

## 🐛 Troubleshooting

### Dashboard não inicia
```bash
# Verificar logs
pm2 logs mockmail-watch

# Verificar se a porta está disponível
netstat -tlnp | grep :3001
```

### APIs retornando erros
```bash
# Verificar se os logs do MockMail existem
ls -la /var/log/mockmail/

# Verificar se o PM2 está rodando MockMail API
pm2 status mockmail-api

# Testar API diretamente
curl http://localhost:3001/api/metrics
```

### HAProxy não direcionando tráfego
```bash
# Verificar sintaxe do HAProxy
sudo haproxy -f /etc/haproxy/haproxy.cfg -c

# Verificar logs do HAProxy
sudo tail -f /var/log/haproxy.log

# Testar health check
curl -I http://localhost:3001/api/metrics
```

## 📂 Estrutura do Projeto

```
mockmail-watch/
├── app/
│   ├── api/
│   │   ├── chart-data/
│   │   ├── errors/
│   │   └── metrics/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ApiEndpointStatus.tsx
│   ├── Dashboard.tsx
│   ├── EmailMetricsChart.tsx
│   ├── MetricCard.tsx
│   ├── RecentErrors.tsx
│   └── SystemStatus.tsx
├── lib/
│   └── hooks/
│       └── useMetrics.ts
├── deploy.sh
├── ecosystem.config.js
└── haproxy.cfg
```

## 🤝 Contribuição

Para contribuir com o projeto:

1. Faça suas alterações
2. Teste localmente com `npm run dev`
3. Execute o deploy com `./deploy.sh`
4. Verifique se o dashboard está funcionando corretamente

## 📄 Licença

Este projeto faz parte do sistema MockMail.
