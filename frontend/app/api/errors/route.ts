import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

const LOG_FILE = '/var/log/mockmail/email_processor.log';

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
    let cleaned = logTimestamp;
    if (cleaned.includes(',')) {
      cleaned = cleaned.split(',')[0];
    }
    return cleaned;
  } catch {
    return logTimestamp;
  }
}

// Lê e processa logs de forma segura (sem shell injection)
async function parseLogErrors(): Promise<ErrorEntry[]> {
  try {
    const errors: ErrorEntry[] = [];

    let logContent: string;
    try {
      logContent = await readFile(LOG_FILE, 'utf-8');
    } catch {
      // Log file não existe em desenvolvimento
      return [];
    }

    const lines = logContent.split('\n');
    const recentLines = lines.slice(-100); // Últimas 100 linhas

    // Buscar erros 400 no log
    const error400Lines = recentLines
      .filter(line => line.includes('400 Client Error'))
      .slice(-10);

    error400Lines.forEach(line => {
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

    // Buscar erros de conexão
    const connectionErrorLines = recentLines
      .filter(line =>
        line.toLowerCase().includes('connection') &&
        line.toLowerCase().includes('error')
      )
      .slice(-5);

    connectionErrorLines.forEach(line => {
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

    // Buscar avisos
    const warningLines = recentLines
      .filter(line =>
        line.toLowerCase().includes('warning') ||
        line.toLowerCase().includes('warn')
      )
      .slice(-5);

    warningLines.forEach(line => {
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
