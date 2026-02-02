# Scripts do MockMail.dev

Scripts de deploy, utilitários e configuração do sistema.

## 📦 Scripts de Deploy

| Script | Descrição |
|--------|-----------|
| `deploy-docker.sh` | Gerencia containers Docker (MongoDB, Redis) |
| `deploy-hot.sh` | Deploy sem downtime |
| `gerar-certificados.sh` | Gera certificados SSL via Let's Encrypt |
| `gerar-secrets.sh` | Gera senhas seguras para produção |

## 🔧 Scripts de Sistema

| Script | Descrição |
|--------|-----------|
| `email-handler.sh` | Recebe emails do Postfix e envia para FIFO |
| `health-check.sh` | Verifica saúde dos serviços |
| `backup.sh` | Backup do MongoDB |
| `diagnostico-producao.sh` | Diagnóstico completo do ambiente |
| `security-check-repo.sh` | Verifica segurança do repositório |

## 🔍 Utilitários

| Script | Descrição |
|--------|-----------|
| `auto-claude.sh` | Automação com Claude Code |
| `system_health_monitor.sh` | Monitor de saúde do sistema |
| `diagnostico-box-emails.js` | Debug de caixas de email |

## 📧 email-handler.sh

Script usado pelo Postfix para processar emails recebidos.

### Instalação no Servidor

```bash
sudo cp scripts/email-handler.sh /usr/local/bin/email-handler.sh
sudo chmod +x /usr/local/bin/email-handler.sh
sudo chown email-processor:email-processor /usr/local/bin/email-handler.sh
```

### Configuração no Postfix (master.cf)

```
email-processor unix - n n - - pipe
    flags=FR user=email-processor argv=/usr/local/bin/email-handler.sh
```

### Funcionamento

1. Recebe email via stdin do Postfix
2. Escreve no FIFO `/var/spool/email-processor`
3. Adiciona delimitador `\n\n\n` para separar emails
4. Loga início e fim do processamento via syslog
