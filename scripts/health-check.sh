#!/bin/bash
echo "=== MockMail Health Check ==="
curl -s http://localhost:3000/api/health | jq .
pm2 status
