#!/bin/bash
logger -t email-proc "Starting email processing"
cat >> /var/spool/email-processor
echo -e "\n\n\n" >> /var/spool/email-processor
logger -t email-proc "Finished email processing"
