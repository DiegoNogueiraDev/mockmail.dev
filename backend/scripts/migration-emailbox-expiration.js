/**
 * Migration Script: EmailBox Expiration Feature
 *
 * Este script prepara o banco de dados para a funcionalidade de expiração automática de caixas.
 *
 * Funcionalidades:
 * - Diagnóstico do estado atual do banco
 * - Correção do índice TTL para expiração automática
 * - Migração de caixas existentes (adiciona expiresAt e isCustom)
 * - Limpeza de emails órfãos (emails sem caixa associada)
 *
 * Uso:
 *   node scripts/migration-emailbox-expiration.js [comando]
 *
 * Comandos:
 *   diagnose  - Apenas diagnóstico, não faz alterações (padrão)
 *   migrate   - Executa migração completa
 *   fix-index - Apenas corrige o índice TTL
 *   fix-boxes - Apenas migra caixas sem expiresAt
 *   cleanup   - Remove emails órfãos
 *
 * Variáveis de ambiente:
 *   MONGO_URI - Connection string do MongoDB (obrigatório)
 *   DRY_RUN   - Se "true", apenas simula as alterações (padrão: false)
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// Configuração
const MONGO_URI = process.env.MONGO_URI;
const DRY_RUN = process.env.DRY_RUN === 'true';
const EXPIRATION_HOURS = 24;

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(60));
  log(` ${title}`, colors.bright + colors.cyan);
  console.log('═'.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

async function diagnose(db) {
  logSection('DIAGNÓSTICO DO BANCO DE DADOS');

  const results = {
    hasIssues: false,
    indexOk: false,
    boxesWithoutExpiration: 0,
    orphanEmails: 0,
    totalBoxes: 0,
    totalEmails: 0,
  };

  // 1. Verificar índices
  log('\n📊 Verificando índices da collection emailboxes...');
  const indexes = await db.collection('emailboxes').indexes();
  const expiresAtIndex = indexes.find(i => i.name === 'expiresAt_1');

  if (!expiresAtIndex) {
    logWarning('Índice expiresAt_1 NÃO existe');
    results.hasIssues = true;
  } else if (expiresAtIndex.expireAfterSeconds === undefined) {
    logWarning('Índice expiresAt_1 existe mas SEM TTL (expireAfterSeconds)');
    logInfo('  Atual: ' + JSON.stringify(expiresAtIndex));
    results.hasIssues = true;
  } else {
    logSuccess(`Índice TTL OK (expireAfterSeconds: ${expiresAtIndex.expireAfterSeconds})`);
    results.indexOk = true;
  }

  // 2. Contar caixas
  results.totalBoxes = await db.collection('emailboxes').countDocuments();
  log(`\n📦 Total de caixas: ${results.totalBoxes}`);

  // 3. Verificar caixas sem expiresAt
  results.boxesWithoutExpiration = await db.collection('emailboxes').countDocuments({
    expiresAt: { $exists: false }
  });

  if (results.boxesWithoutExpiration > 0) {
    logWarning(`${results.boxesWithoutExpiration} caixas SEM campo expiresAt`);
    results.hasIssues = true;
  } else {
    logSuccess('Todas as caixas têm campo expiresAt');
  }

  // 4. Verificar caixas sem isCustom
  const boxesWithoutIsCustom = await db.collection('emailboxes').countDocuments({
    isCustom: { $exists: false }
  });

  if (boxesWithoutIsCustom > 0) {
    logWarning(`${boxesWithoutIsCustom} caixas SEM campo isCustom`);
  }

  // 5. Contar emails
  results.totalEmails = await db.collection('emails').countDocuments();
  log(`\n📧 Total de emails: ${results.totalEmails}`);

  // 6. Verificar emails órfãos
  const allBoxIds = await db.collection('emailboxes').distinct('_id');
  results.orphanEmails = await db.collection('emails').countDocuments({
    emailBoxId: { $nin: allBoxIds }
  });

  if (results.orphanEmails > 0) {
    logWarning(`${results.orphanEmails} emails ÓRFÃOS (sem caixa associada)`);
    results.hasIssues = true;
  } else {
    logSuccess('Nenhum email órfão encontrado');
  }

  // 7. Verificar caixas que vão expirar em breve
  const expiringIn1h = await db.collection('emailboxes').countDocuments({
    expiresAt: {
      $exists: true,
      $lt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });

  if (expiringIn1h > 0) {
    logInfo(`${expiringIn1h} caixas expiram na próxima hora`);
  }

  // 8. Estatísticas de expiração
  const expiredBoxes = await db.collection('emailboxes').countDocuments({
    expiresAt: { $lt: new Date() }
  });

  if (expiredBoxes > 0) {
    logWarning(`${expiredBoxes} caixas já EXPIRADAS (aguardando limpeza do MongoDB)`);
  }

  // Resumo
  logSection('RESUMO DO DIAGNÓSTICO');

  if (results.hasIssues) {
    logError('Foram encontrados problemas que precisam ser corrigidos!');
    log('\nExecute: node scripts/migration-emailbox-expiration.js migrate');
  } else {
    logSuccess('Banco de dados está OK para a funcionalidade de expiração!');
  }

  return results;
}

async function fixTTLIndex(db) {
  logSection('CORREÇÃO DO ÍNDICE TTL');

  if (DRY_RUN) {
    logInfo('[DRY RUN] Simulando correção do índice...');
  }

  const indexes = await db.collection('emailboxes').indexes();
  const expiresAtIndex = indexes.find(i => i.name === 'expiresAt_1');

  if (expiresAtIndex && expiresAtIndex.expireAfterSeconds !== undefined) {
    logSuccess('Índice TTL já está correto, nada a fazer');
    return true;
  }

  // Dropar índice existente se houver
  if (expiresAtIndex) {
    log('Removendo índice existente sem TTL...');
    if (!DRY_RUN) {
      await db.collection('emailboxes').dropIndex('expiresAt_1');
      logSuccess('Índice antigo removido');
    } else {
      logInfo('[DRY RUN] Removeria índice expiresAt_1');
    }
  }

  // Criar índice TTL
  log('Criando índice TTL com expireAfterSeconds: 0...');
  if (!DRY_RUN) {
    await db.collection('emailboxes').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );
    logSuccess('Índice TTL criado com sucesso');
  } else {
    logInfo('[DRY RUN] Criaria índice TTL');
  }

  return true;
}

async function migrateBoxes(db) {
  logSection('MIGRAÇÃO DE CAIXAS EXISTENTES');

  if (DRY_RUN) {
    logInfo('[DRY RUN] Simulando migração de caixas...');
  }

  // Encontrar caixas sem expiresAt
  const boxesWithoutExpiration = await db.collection('emailboxes').countDocuments({
    expiresAt: { $exists: false }
  });

  if (boxesWithoutExpiration === 0) {
    logSuccess('Todas as caixas já têm expiresAt, nada a fazer');
    return 0;
  }

  log(`Encontradas ${boxesWithoutExpiration} caixas para migrar...`);

  // Calcular nova data de expiração (24h a partir de agora)
  const newExpiresAt = new Date(Date.now() + EXPIRATION_HOURS * 60 * 60 * 1000);

  log(`Nova data de expiração: ${newExpiresAt.toISOString()}`);

  if (!DRY_RUN) {
    const result = await db.collection('emailboxes').updateMany(
      { expiresAt: { $exists: false } },
      {
        $set: {
          expiresAt: newExpiresAt,
          isCustom: false
        }
      }
    );
    logSuccess(`${result.modifiedCount} caixas migradas com sucesso`);
    return result.modifiedCount;
  } else {
    logInfo(`[DRY RUN] Migraria ${boxesWithoutExpiration} caixas`);
    return boxesWithoutExpiration;
  }
}

async function cleanupOrphanEmails(db) {
  logSection('LIMPEZA DE EMAILS ÓRFÃOS');

  if (DRY_RUN) {
    logInfo('[DRY RUN] Simulando limpeza de emails órfãos...');
  }

  // Encontrar todos os IDs de caixas existentes
  const allBoxIds = await db.collection('emailboxes').distinct('_id');

  // Contar emails órfãos
  const orphanCount = await db.collection('emails').countDocuments({
    emailBoxId: { $nin: allBoxIds }
  });

  if (orphanCount === 0) {
    logSuccess('Nenhum email órfão encontrado');
    return 0;
  }

  log(`Encontrados ${orphanCount} emails órfãos para remover...`);

  if (!DRY_RUN) {
    const result = await db.collection('emails').deleteMany({
      emailBoxId: { $nin: allBoxIds }
    });
    logSuccess(`${result.deletedCount} emails órfãos removidos`);
    return result.deletedCount;
  } else {
    logInfo(`[DRY RUN] Removeria ${orphanCount} emails órfãos`);
    return orphanCount;
  }
}

async function runFullMigration(db) {
  logSection('MIGRAÇÃO COMPLETA');

  const startTime = Date.now();

  // 1. Diagnóstico inicial
  await diagnose(db);

  // 2. Corrigir índice TTL
  await fixTTLIndex(db);

  // 3. Migrar caixas
  await migrateBoxes(db);

  // 4. Limpar emails órfãos
  await cleanupOrphanEmails(db);

  // 5. Diagnóstico final
  log('\n');
  await diagnose(db);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logSection('MIGRAÇÃO CONCLUÍDA');
  log(`Tempo total: ${duration}s`);

  if (DRY_RUN) {
    logWarning('Esta foi uma execução DRY RUN - nenhuma alteração foi feita');
    log('Para executar de verdade, remova DRY_RUN=true');
  }
}

async function main() {
  // Validar MONGO_URI
  if (!MONGO_URI) {
    logError('MONGO_URI não definida!');
    log('Defina a variável de ambiente MONGO_URI ou crie um arquivo .env');
    process.exit(1);
  }

  // Parse do comando
  const command = process.argv[2] || 'diagnose';
  const validCommands = ['diagnose', 'migrate', 'fix-index', 'fix-boxes', 'cleanup'];

  if (!validCommands.includes(command)) {
    logError(`Comando inválido: ${command}`);
    log(`Comandos válidos: ${validCommands.join(', ')}`);
    process.exit(1);
  }

  // Banner
  console.log('\n');
  log('╔══════════════════════════════════════════════════════════╗', colors.cyan);
  log('║     MOCKMAIL.DEV - Migration: EmailBox Expiration        ║', colors.cyan);
  log('╚══════════════════════════════════════════════════════════╝', colors.cyan);

  log(`\nComando: ${command}`, colors.bright);
  if (DRY_RUN) {
    logWarning('Modo DRY RUN ativado - nenhuma alteração será feita');
  }

  // Conectar ao MongoDB
  log('\nConectando ao MongoDB...');
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    logSuccess('Conectado ao MongoDB');

    const db = client.db();
    log(`Database: ${db.databaseName}`);

    // Executar comando
    switch (command) {
      case 'diagnose':
        await diagnose(db);
        break;
      case 'migrate':
        await runFullMigration(db);
        break;
      case 'fix-index':
        await fixTTLIndex(db);
        break;
      case 'fix-boxes':
        await migrateBoxes(db);
        break;
      case 'cleanup':
        await cleanupOrphanEmails(db);
        break;
    }

  } catch (error) {
    logError(`Erro: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
    log('\nConexão fechada.');
  }
}

// Executar
main().catch(console.error);
