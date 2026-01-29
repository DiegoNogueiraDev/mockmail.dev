import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ErrorEntry {
  timestamp: string;
  type: 'error' | 'warning' | 'critical';
  message: string;
  source: string;
  count: number;
}

// Função para limpar timestamp do log (remover milissegundos)
function cleanLogTimestamp(logTimestamp: string): string {
  try {
    // Remover vírgula e milissegundos se existirem
    let cleaned = logTimestamp;
    if (cleaned.includes(',')) {
      cleaned = cleaned.split(',')[0];
    }
    
    return cleaned;
  } catch (error) {
    console.error('Erro ao limpar timestamp:', error);
    return logTimestamp;
  }
}

async function parseLogErrors() {
  try {
    const errors: ErrorEntry[] = [];
    
    // Buscar erros 400 no log do email processor
    const { stdout: error400 } = await execAsync(
      'tail -n 100 /var/log/mockmail/email_processor.log | grep "400 Client Error" | tail -10'
    );
    
    if (error400.trim()) {
      error400.trim().split('\n').forEach(line => {
        // Capturar timestamp completo com vírgula e milissegundos
        const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[,.]?\d*)/);
        if (match) {
          errors.push({
            timestamp: cleanLogTimestamp(match[1]),
            type: 'error',
            message: 'Email processing failed (400 Client Error)',
            source: 'email_processor',
            count: 1,
          });
        }
      });
    }
    
    // Buscar erros de conexão
    const { stdout: connectionErrors } = await execAsync(
      'tail -n 100 /var/log/mockmail/email_processor.log | grep -i "connection" | grep -i "error" | tail -5'
    );
    
    if (connectionErrors.trim()) {
      connectionErrors.trim().split('\n').forEach(line => {
        const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[,.]?\d*)/);
        if (match) {
          errors.push({
            timestamp: cleanLogTimestamp(match[1]),
            type: 'critical',
            message: 'Connection error detected',
            source: 'email_processor',
            count: 1,
          });
        }
      });
    }
    
    // Buscar avisos no log geral
    const { stdout: warnings } = await execAsync(
      'tail -n 50 /var/log/mockmail/email_processor.log | grep -i "warning\\|warn" | tail -5'
    );
    
    if (warnings.trim()) {
      warnings.trim().split('\n').forEach(line => {
        const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[,.]?\d*)/);
        if (match) {
          errors.push({
            timestamp: cleanLogTimestamp(match[1]),
            type: 'warning',
            message: 'System warning detected',
            source: 'email_processor',
            count: 1,
          });
        }
      });
    }
    
    // Verificar PM2 logs para erros
    try {
      const { stdout: pm2Logs } = await execAsync('pm2 logs mockmail-api --lines 20 --nostream 2>/dev/null || echo ""');
      
      if (pm2Logs.includes('Error') || pm2Logs.includes('ERROR')) {
        // Para PM2 logs sem timestamp específico, usar horário brasileiro atual
        const now = new Date();
        const formatted = now.toISOString().substring(0, 19).replace('T', ' ');
        
        errors.push({
          timestamp: formatted,
          type: 'error',
          message: 'API error detected in PM2 logs',
          source: 'mockmail-api',
          count: 1,
        });
      }
    } catch {
      // PM2 logs não disponíveis
    }
    
    // Ordenar por timestamp (mais recentes primeiro)
    return errors.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
  } catch (error) {
    console.error('Erro ao analisar logs:', error);
    return [];
  }
}

export async function GET() {
  try {
    const errors = await parseLogErrors();
    
    return NextResponse.json({
      errors,
      summary: {
        total: errors.length,
        byType: {
          error: errors.filter(e => e.type === 'error').length,
          warning: errors.filter(e => e.type === 'warning').length,
          critical: errors.filter(e => e.type === 'critical').length,
        },
      },
      lastUpdate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao buscar erros:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
