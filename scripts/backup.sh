#!/bin/bash
# MockMail Backup Script
BACKUP_DIR=~/backups/mockmail-$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR
echo "Backup em: $BACKUP_DIR"
mongodump --out $BACKUP_DIR/mongodb 2>/dev/null || echo "MongoDB backup skipped"
cp -r ~/mockmail $BACKUP_DIR/code
echo "Backup completo!"
