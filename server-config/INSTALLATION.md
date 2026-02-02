# Guia de Instalação do MockMail Server

## Pré-requisitos

- Ubuntu 22.04+
- Node.js 23.8.0+
- Python 3.x
- MongoDB
- Postfix
- HAProxy

## 1. Instalar Dependências do Sistema

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 23.8.0
nvm use 23.8.0

# Instalar PM2
npm install -g pm2

# Instalar MongoDB
sudo apt install -y mongodb

# Instalar Postfix
sudo apt install -y postfix

# Instalar HAProxy
sudo apt install -y haproxy

# Instalar Python e pip
sudo apt install -y python3 python3-pip python3-venv
```

## 2. Clonar Repositório

```bash
cd ~
git clone https://github.com/DiegoNogueiraDev/mockmail.dev.git mockmail
cd mockmail
```

## 3. Configurar MongoDB

```bash
# Editar script e adicionar senhas
nano server-config/mongodb/mongodb-setup.sh

# Executar setup
bash server-config/mongodb/mongodb-setup.sh
```

## 4. Configurar Postfix

```bash
# Copiar configuração
sudo cp server-config/postfix/main.cf /etc/postfix/main.cf
sudo cp server-config/postfix/master.cf /etc/postfix/master.cf

# Reiniciar Postfix
sudo systemctl restart postfix
sudo systemctl enable postfix
```

## 5. Configurar HAProxy

```bash
# Copiar configuração
sudo cp server-config/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg

# Reiniciar HAProxy
sudo systemctl restart haproxy
sudo systemctl enable haproxy
```

## 6. Configurar Email Processor

```bash
# Criar ambiente virtual Python
cd email-processor
python3 -m venv venv
source venv/bin/activate
pip install pymongo

# Criar serviço systemd
sudo cp ../server-config/systemd/email-processor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable email-processor
sudo systemctl start email-processor
```

## 7. Configurar Aplicações Node.js

```bash
# Configurar variáveis de ambiente
cd ~/mockmail
cp api/.env.example api/.env
nano api/.env  # Editar com suas configurações

# Instalar dependências e buildar
cd api && npm install && npm run build
cd ../watch && npm install && npm run build
```

## 8. Configurar PM2

```bash
cd ~/mockmail

# Iniciar serviços
pm2 start ecosystem.config.js
pm2 save

# Configurar auto-start
pm2 startup
# Copiar e executar o comando gerado

# Ou instalar serviço systemd
sudo cp server-config/systemd/pm2-anaopcd.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pm2-anaopcd
sudo systemctl start pm2-anaopcd
```

## 9. Verificar Instalação

```bash
# Verificar serviços
pm2 status
systemctl status postfix
systemctl status haproxy
systemctl status email-processor

# Testar API
curl http://localhost:3000/api/health

# Testar Dashboard
curl http://localhost:3001
```

## 10. Configurar SSL (Opcional)

```bash
# Gerar certificado auto-assinado
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/mockmail.key \
  -out /etc/ssl/certs/mockmail.crt

# Atualizar HAProxy para usar SSL
```

## Manutenção

### Atualizar Sistema
```bash
cd ~/mockmail
git pull origin master
./deploy.sh
```

### Backup
```bash
# Backup MongoDB
mongodump --out ~/backups/mongodb-$(date +%Y%m%d)

# Commit configurações
cd ~/mockmail
git add -A
git commit -m "Backup $(date +%Y-%m-%d)"
git push
```

### Logs
```bash
# PM2
pm2 logs

# Postfix
sudo tail -f /var/log/mail.log

# HAProxy
sudo tail -f /var/log/haproxy.log

# Email Processor
sudo journalctl -u email-processor -f
```

## Troubleshooting

### Serviço não inicia
```bash
# Verificar logs
pm2 logs mockmail-api
pm2 logs mockmail-watch

# Reiniciar tudo
pm2 restart all
sudo systemctl restart haproxy
sudo systemctl restart postfix
```

### MongoDB connection error
```bash
# Verificar se está rodando
systemctl status mongodb

# Testar conexão
mongo
```

### Port já em uso
```bash
# Verificar portas em uso
netstat -tulpn | grep LISTEN

# Matar processo específico
sudo kill -9 <PID>
```
