import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readFile } from 'fs/promises';

const LOG_FILE = '/var/log/mockmail/email_processor.log';

interface DailyStats {
  date: string;
  emailsProcessed: number;
  emailsErrors: number;
  successRate: number;
}

interface DailyStatsResponse {
  today: DailyStats;
  yesterday: DailyStats;
  last7Days: DailyStats[];
  last30Days: DailyStats[];
  summary: {
    totalEmailsLast7Days: number;
    totalErrorsLast7Days: number;
    avgSuccessRateLast7Days: number;
  };
  lastUpdate: string;
}

// Cache do log para evitar leitura múltipla
let logCache: { lines: string[]; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 1 minuto

async function getLogLines(): Promise<string[]> {
  const now = Date.now();

  // Verificar cache
  if (logCache && (now - logCache.timestamp) < CACHE_TTL) {
    return logCache.lines;
  }

  try {
    const logContent = await readFile(LOG_FILE, 'utf-8');
    const lines = logContent.split('\n');
    logCache = { lines, timestamp: now };
    return lines;
  } catch {
    return [];
  }
}

async function getDailyStats(date: string, logLines: string[]): Promise<DailyStats> {
  try {
    // Filtrar linhas do dia
    const dayLines = logLines.filter(line => line.startsWith(date));

    // Contar sucessos e erros
    const emailsProcessed = dayLines.filter(line =>
      line.includes('E-mail processado com sucesso')
    ).length;

    const emailsErrors = dayLines.filter(line =>
      line.includes('400 Client Error')
    ).length;

    const totalEmails = emailsProcessed + emailsErrors;
    const successRate = totalEmails > 0
      ? Math.round((emailsProcessed / totalEmails) * 100)
      : 100;

    return {
      date,
      emailsProcessed,
      emailsErrors,
      successRate,
    };
  } catch (error) {
    // Error getting stats for date
    return {
      date,
      emailsProcessed: 0,
      emailsErrors: 0,
      successRate: 100,
    };
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    if (!cookieStore.get('mockmail_access_token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const today = now.toISOString().substring(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);

    // Ler log uma única vez
    const logLines = await getLogLines();

    // Gerar dados dos últimos 7 dias
    const last7Days: DailyStats[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(0, 10);
      const stats = await getDailyStats(dateStr, logLines);
      last7Days.push(stats);
    }

    // Gerar dados dos últimos 30 dias
    const last30Days: DailyStats[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(0, 10);
      const stats = await getDailyStats(dateStr, logLines);
      last30Days.push(stats);
    }

    // Calcular resumos
    const totalEmailsLast7Days = last7Days.reduce((sum, day) => sum + day.emailsProcessed, 0);
    const totalErrorsLast7Days = last7Days.reduce((sum, day) => sum + day.emailsErrors, 0);
    const avgSuccessRateLast7Days = Math.round(
      last7Days.reduce((sum, day) => sum + day.successRate, 0) / last7Days.length
    );

    const response: DailyStatsResponse = {
      today: await getDailyStats(today, logLines),
      yesterday: await getDailyStats(yesterdayStr, logLines),
      last7Days,
      last30Days,
      summary: {
        totalEmailsLast7Days,
        totalErrorsLast7Days,
        avgSuccessRateLast7Days,
      },
      lastUpdate: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    // Error fetching daily stats
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
