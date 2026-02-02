# Scripts de Sistema

Este diretório contém scripts que devem ser instalados no sistema para o funcionamento do MockMail.

## email-handler.sh

Script usado pelo Postfix para processar emails recebidos.

### Instalação

```bash
sudo cp scripts/email-handler.sh /usr/local/bin/email-handler.sh
sudo chmod +x /usr/local/bin/email-handler.sh
sudo chown email-processor:email-processor /usr/local/bin/email-handler.sh
```

### Configuração no Postfix

O script é chamado através do `master.cf`:

```
email-processor unix - n n - - pipe
    flags=FR user=email-processor argv=/usr/local/bin/email-handler.sh
```

### Funcionamento

1. Recebe email via stdin do Postfix
2. Escreve no FIFO `/var/spool/email-processor`
3. Adiciona delimitador `\n\n\n` para separar emails
4. Loga início e fim do processamento via syslog
