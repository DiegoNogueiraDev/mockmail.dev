import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

async function getDailyStats(date: string): Promise<DailyStats> {
  try {
    // Buscar sucessos para o dia
    const { stdout: successCount } = await execAsync(
      `grep "^${date}" /var/log/mockmail/email_processor.log | grep -c "E-mail processado com sucesso" || echo "0"`
    );
    
    // Buscar erros para o dia
    const { stdout: errorCount } = await execAsync(
      `grep "^${date}" /var/log/mockmail/email_processor.log | grep -c "400 Client Error" || echo "0"`
    );
    
    const emailsProcessed = parseInt(successCount.trim()) || 0;
    const emailsErrors = parseInt(errorCount.trim()) || 0;
    const totalEmails = emailsProcessed + emailsErrors;
    const successRate = totalEmails > 0 ? Math.round((emailsProcessed / totalEmails) * 100) : 100;
    
    return {
      date,
      emailsProcessed,
      emailsErrors,
      successRate,
    };
  } catch (error) {
    console.error(`Erro ao obter estatísticas para ${date}:`, error);
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
    const now = new Date();
    const today = now.toISOString().substring(0, 10);
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);
    
    // Gerar dados dos últimos 7 dias
    const last7Days: DailyStats[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(0, 10);
      const stats = await getDailyStats(dateStr);
      last7Days.push(stats);
    }
    
    // Gerar dados dos últimos 30 dias (resumido)
    const last30Days: DailyStats[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(0, 10);
      const stats = await getDailyStats(dateStr);
      last30Days.push(stats);
    }
    
    // Calcular resumos
    const totalEmailsLast7Days = last7Days.reduce((sum, day) => sum + day.emailsProcessed, 0);
    const totalErrorsLast7Days = last7Days.reduce((sum, day) => sum + day.emailsErrors, 0);
    const avgSuccessRateLast7Days = Math.round(
      last7Days.reduce((sum, day) => sum + day.successRate, 0) / last7Days.length
    );
    
    const response: DailyStatsResponse = {
      today: await getDailyStats(today),
      yesterday: await getDailyStats(yesterdayStr),
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
    console.error('Erro ao buscar estatísticas diárias:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
