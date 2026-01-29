#!/bin/bash
logger -t email-proc "Starting email processing"
cat >> /var/spool/email-processor
logger -t email-proc "Finished email processing"
