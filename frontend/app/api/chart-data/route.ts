import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

const LOG_FILE = '/var/log/mockmail/email_processor.log';

interface ChartDataPoint {
  hour: string;
  success: number;
  errors: number;
  timestamp: string;
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hour}`;
}

async function generateChartData(): Promise<ChartDataPoint[]> {
  try {
    const chartData: ChartDataPoint[] = [];
    const now = new Date();

    // Ler log uma única vez
    let logLines: string[] = [];
    try {
      const logContent = await readFile(LOG_FILE, 'utf-8');
      logLines = logContent.split('\n');
    } catch {
      // Log file não existe em desenvolvimento - retornar zeros
      for (let i = 23; i >= 0; i--) {
        const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
        const displayHour = hourDate.getHours().toString().padStart(2, '0') + ':00';
        chartData.push({
          hour: displayHour,
          success: 0,
          errors: 0,
          timestamp: hourDate.toISOString(),
        });
      }
      return chartData;
    }

    // Gerar dados para as últimas 24 horas
    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourStr = formatDateLocal(hourDate);
      const displayHour = hourDate.getHours().toString().padStart(2, '0') + ':00';

      // Filtrar linhas desta hora
      const hourLines = logLines.filter(line => line.startsWith(hourStr));

      // Contar sucessos e erros
      const successCount = hourLines.filter(line =>
        line.includes('E-mail processado com sucesso')
      ).length;

      const errorCount = hourLines.filter(line =>
        line.includes('400 Client Error')
      ).length;

      chartData.push({
        hour: displayHour,
        success: successCount,
        errors: errorCount,
        timestamp: hourDate.toISOString(),
      });
    }

    return chartData;
  } catch (error) {
    console.error('Erro ao gerar dados do gráfico:', error);

    // Retornar zeros em caso de erro
    const fallbackData: ChartDataPoint[] = [];
    const now = new Date();

    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
      const displayHour = hourDate.getHours().toString().padStart(2, '0') + ':00';

      fallbackData.push({
        hour: displayHour,
        success: 0,
        errors: 0,
        timestamp: hourDate.toISOString(),
      });
    }

    return fallbackData;
  }
}

export async function GET() {
  try {
    const chartData = await generateChartData();

    const totalSuccess = chartData.reduce((sum, point) => sum + point.success, 0);
    const totalErrors = chartData.reduce((sum, point) => sum + point.errors, 0);
    const totalEmails = totalSuccess + totalErrors;

    return NextResponse.json({
      data: chartData,
      summary: {
        totalSuccess,
        totalErrors,
        totalEmails,
        successRate: totalEmails > 0 ? Math.round((totalSuccess / totalEmails) * 100) : 0,
      },
      lastUpdate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao buscar dados do gráfico:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
