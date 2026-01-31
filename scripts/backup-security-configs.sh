#!/bin/bash
# Backup de Configurações de Segurança

BACKUP_DIR=~/security-backups/$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# Backup de configurações SSH
cp ~/.ssh/authorized_keys $BACKUP_DIR/
sudo cp /etc/ssh/sshd_config $BACKUP_DIR/

# Backup de crontab
crontab -l > $BACKUP_DIR/crontab.txt

# Backup de configurações de firewall
sudo ufw status verbose > $BACKUP_DIR/ufw-status.txt

# Backup de fail2ban
sudo fail2ban-client status > $BACKUP_DIR/fail2ban-status.txt

# Backup de aplicações
tar -czf $BACKUP_DIR/bashrc-profile.tar.gz ~/.bashrc ~/.profile 2>/dev/null

echo "Backup criado em $BACKUP_DIR"
ls -lh $BACKUP_DIR/
