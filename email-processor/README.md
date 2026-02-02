# Email Processor - Integração Postfix com MockMail

## Descrição
Processa emails recebidos pelo Postfix e os armazena no MongoDB via API.

## Arquivos

- `email_processor.py`: Script principal em Python
- `email-handler.sh`: Script chamado pelo Postfix
- `requirements.txt`: Dependências Python

## Instalação

### 1. Criar usuário do sistema
```bash
sudo useradd -r -s /bin/false email-processor
```

### 2. Criar diretórios
```bash
sudo mkdir -p /opt/mockmail /var/log/mockmail /var/spool
sudo chown email-processor:email-processor /var/log/mockmail
```

### 3. Copiar arquivos
```bash
sudo cp email_processor.py /opt/mockmail/
sudo cp email-handler.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/email-handler.sh
```

### 4. Instalar dependências Python
```bash
sudo mkdir -p /opt/mockmail/venv
cd /opt/mockmail
sudo python3 -m venv venv
sudo /opt/mockmail/venv/bin/pip install -r ~/mockmail/email-processor/requirements.txt
sudo chown -R email-processor:email-processor /opt/mockmail
```

### 5. Criar FIFO
```bash
sudo mkfifo /var/spool/email-processor
sudo chown email-processor:email-processor /var/spool/email-processor
sudo chmod 660 /var/spool/email-processor
```

### 6. Instalar serviço systemd
```bash
sudo cp ../server-config/systemd/email-processor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable email-processor
sudo systemctl start email-processor
```

### 7. Configurar Postfix
Adicionar ao `/etc/postfix/master.cf`:
```
email-processor unix - n n - - pipe
    flags=FR user=email-processor argv=/usr/local/bin/email-handler.sh
```

Adicionar ao `/etc/postfix/main.cf`:
```
virtual_transport = email-processor
```

Reiniciar Postfix:
```bash
sudo systemctl restart postfix
```

## Verificação

### Verificar serviço
```bash
sudo systemctl status email-processor
```

### Verificar logs
```bash
sudo journalctl -u email-processor -f
sudo tail -f /var/log/mockmail/email_processor.log
```

### Testar email
```bash
echo "Subject: Test" | sendmail test@mockmail.dev
```

## Configuração

O script usa as seguintes variáveis (no topo do `email_processor.py`):

```python
FIFO_PATH = "/var/spool/email-processor"
OUTPUT_FILE = "/var/log/mockmail/emails.json"
LOG_FILE = "/var/log/mockmail/email_processor.log"
API_BASE_URL = "https://api.mockmail.dev"
SYSTEM_EMAIL = "system@mockmail.dev"
SYSTEM_PASSWORD = "SEU_PASSWORD_AQUI"
```

## Troubleshooting

### FIFO não existe
```bash
sudo mkfifo /var/spool/email-processor
sudo chown email-processor:email-processor /var/spool/email-processor
```

### Permissões
```bash
sudo chown -R email-processor:email-processor /opt/mockmail
sudo chown -R email-processor:email-processor /var/log/mockmail
```

### Logs
```bash
# Verificar erros
sudo journalctl -u email-processor --since "10 minutes ago"

# Log do processador
sudo tail -100 /var/log/mockmail/email_processor.log
```
