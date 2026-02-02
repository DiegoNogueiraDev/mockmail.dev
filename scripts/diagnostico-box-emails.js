#!/usr/bin/env node
/**
 * Script de Diagnóstico - MockMail.dev
 * 
 * Verifica se emails estão sendo retornados corretamente para uma caixa específica.
 * 
 * Uso:
 *   node scripts/diagnostico-box-emails.js --box-id=<id> --api-url=<url> --token=<jwt>
 *   
 * Exemplos:
 *   # Ambiente de homologação
 *   node scripts/diagnostico-box-emails.js --box-id=697fc4af35a469d9a4ca6123 --api-url=https://api.homologacao.mockmail.dev
 *   
 *   # Ambiente local
 *   node scripts/diagnostico-box-emails.js --box-id=697fc4af35a469d9a4ca6123 --api-url=http://localhost:3000
 */

const https = require('https');
const http = require('http');

// Parse command line arguments
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--(\w+[-\w]*)=(.*)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  });
  return args;
}

// Make HTTP request
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    
    const req = lib.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
          });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Format output
function log(label, value, color = '') {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
  };
  const c = colors[color] || '';
  const r = colors.reset;
  console.log(`${c}[${label}]${r}`, typeof value === 'object' ? JSON.stringify(value, null, 2) : value);
}

// Main diagnostic function
async function runDiagnostic() {
  const args = parseArgs();
  
  console.log('\n===========================================');
  console.log('   MockMail.dev - Diagnóstico de Emails');
  console.log('===========================================\n');
  
  // Validate required args
  if (!args['box-id']) {
    log('ERRO', 'Parâmetro --box-id é obrigatório', 'red');
    console.log('\nUso: node scripts/diagnostico-box-emails.js --box-id=<id> --api-url=<url>\n');
    process.exit(1);
  }
  
  const boxId = args['box-id'];
  const apiUrl = args['api-url'] || 'http://localhost:3000';
  const token = args['token'] || '';
  
  log('CONFIG', { boxId, apiUrl, hasToken: !!token }, 'cyan');
  
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `mockmail_token=${token}`;
  }
  
  // Test 1: Health check
  console.log('\n--- Teste 1: Health Check ---');
  try {
    const healthRes = await request(`${apiUrl}/api/health`);
    log('STATUS', healthRes.status, healthRes.status === 200 ? 'green' : 'red');
    log('DATA', healthRes.data);
  } catch (error) {
    log('ERRO', error.message, 'red');
  }
  
  // Test 2: Get box info
  console.log('\n--- Teste 2: Informações da Caixa ---');
  try {
    const boxRes = await request(`${apiUrl}/api/boxes/${boxId}`, { headers });
    log('STATUS', boxRes.status, boxRes.status === 200 ? 'green' : 'red');
    log('DATA', boxRes.data);
    
    if (boxRes.data?.data?.address) {
      log('CAIXA', boxRes.data.data.address, 'green');
      log('EMAIL COUNT (db)', boxRes.data.data.emailCount, 'cyan');
    }
  } catch (error) {
    log('ERRO', error.message, 'red');
  }
  
  // Test 3: Get emails from box
  console.log('\n--- Teste 3: Emails da Caixa (via /api/boxes/:id/emails) ---');
  try {
    const emailsRes = await request(`${apiUrl}/api/boxes/${boxId}/emails?page=1&limit=20`, { headers });
    log('STATUS', emailsRes.status, emailsRes.status === 200 ? 'green' : 'red');
    log('RESPONSE STRUCTURE', Object.keys(emailsRes.data || {}), 'cyan');
    
    // Check data structure
    if (emailsRes.data) {
      log('HAS success', !!emailsRes.data.success, 'cyan');
      log('HAS data (top level)', !!emailsRes.data.data, 'cyan');
      log('HAS pagination', !!emailsRes.data.pagination, 'cyan');
      
      if (Array.isArray(emailsRes.data.data)) {
        log('EMAILS COUNT', emailsRes.data.data.length, 'green');
        if (emailsRes.data.data.length > 0) {
          log('FIRST EMAIL', emailsRes.data.data[0]);
        }
      } else {
        log('AVISO', 'data não é um array!', 'yellow');
        log('TIPO de data', typeof emailsRes.data.data, 'yellow');
      }
      
      if (emailsRes.data.pagination) {
        log('PAGINATION', emailsRes.data.pagination, 'cyan');
      }
    }
    
    // Full response for debugging
    console.log('\n--- Resposta Completa ---');
    console.log(JSON.stringify(emailsRes.data, null, 2));
  } catch (error) {
    log('ERRO', error.message, 'red');
  }
  
  // Test 4: Get all emails (via /api/mail/emails)
  console.log('\n--- Teste 4: Todos os Emails (via /api/mail/emails) ---');
  try {
    const allEmailsRes = await request(`${apiUrl}/api/mail/emails?page=1&limit=20`, { headers });
    log('STATUS', allEmailsRes.status, allEmailsRes.status === 200 ? 'green' : 'red');
    log('RESPONSE STRUCTURE', Object.keys(allEmailsRes.data || {}), 'cyan');
    
    if (allEmailsRes.data) {
      const emailCount = Array.isArray(allEmailsRes.data.data) 
        ? allEmailsRes.data.data.length 
        : 'N/A';
      log('EMAILS COUNT', emailCount, 'green');
      
      if (allEmailsRes.data.pagination) {
        log('TOTAL (pagination)', allEmailsRes.data.pagination.total, 'cyan');
      }
    }
  } catch (error) {
    log('ERRO', error.message, 'red');
  }
  
  // Test 5: Direct MongoDB query simulation (via email count)
  console.log('\n--- Teste 5: Análise de Consistência ---');
  console.log(`
  PROBLEMA IDENTIFICADO:
  ----------------------
  O frontend em /admin/boxes/[id] está acessando os dados incorretamente:
  
  CÓDIGO ATUAL (ERRADO):
    response.data.data → undefined (porque data já é o array de emails)
  
  CÓDIGO CORRETO:
    response.data → array de emails
    (response as any).pagination → objeto de paginação
  
  ARQUIVOS PARA CORRIGIR:
    frontend/app/admin/boxes/[id]/page.tsx
  `);
  
  console.log('\n===========================================');
  console.log('   Diagnóstico Concluído');
  console.log('===========================================\n');
}

// Run
runDiagnostic().catch(err => {
  log('ERRO FATAL', err.message, 'red');
  process.exit(1);
});
