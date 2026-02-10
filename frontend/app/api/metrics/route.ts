import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const LOG_FILE = '/var/log/mockmail/email_processor.log';

interface SystemMetrics {
  emailsProcessed: number;
  emailsPerHour: number;
  emailsToday: number;
  errorsToday: number;
  errorRate: number;
  uptime: string;
  activeUsers: number;
  totalEmailBoxes: number;
  systemStatus: 'online' | 'warning' | 'error';
  lastUpdate: string;
  pm2Status: {
    status: string;
    uptime: string;
    memory?: number;
    cpu?: number;
    restarts?: number;
  } | null;
  diskUsage: Record<string, unknown> | null;
}

interface PM2Process {
  name: string;
  pm2_env: {
    status: string;
    pm_uptime: number;
    memory: number;
    cpu: number;
    restart_time: number;
  };
}

// Sanitiza uma string para uso seguro (remove caracteres perigosos)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _sanitizeForLog(input: string): string {
  return input.replace(/[^\w\s\-:.]/g, '');
}

// Lê e processa logs de forma segura (sem shell injection)
async function getEmailMetrics() {
  try {
    let logContent: string;
    try {
      logContent = await readFile(LOG_FILE, 'utf-8');
    } catch {
      // Log file não existe em desenvolvimento
      return {
        totalProcessed: 0,
        errorRate: 0,
        emailsPerHour: 0,
        emailsToday: 0,
        errorsToday: 0,
      };
    }

    const lines = logContent.split('\n');

    // Contar emails processados com sucesso (total)
    const totalSuccess = lines.filter(line =>
      line.includes('E-mail processado com sucesso')
    ).length;

    // Contar erros 400 (total)
    const totalErrors = lines.filter(line =>
      line.includes('400 Client Error')
    ).length;

    const totalEmails = totalSuccess + totalErrors;
    const errorRate = totalEmails > 0 ? (totalErrors / totalEmails) * 100 : 0;

    // Emails processados hoje
    const today = new Date().toISOString().substring(0, 10);
    const todayLines = lines.filter(line => line.startsWith(today));

    const successToday = todayLines.filter(line =>
      line.includes('E-mail processado com sucesso')
    ).length;

    const errorsToday = todayLines.filter(line =>
      line.includes('400 Client Error')
    ).length;

    // Emails nas últimas 2 horas
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const startTime = twoHoursAgo.toISOString().substring(0, 13).replace('T', ' ');

    const recentLines = lines.filter(line => {
      const lineTime = line.substring(0, 13).replace('T', ' ');
      return lineTime >= startTime;
    });

    const emailsLast2Hours = recentLines.filter(line =>
      line.includes('E-mail processado com sucesso')
    ).length;

    const emailsPerHour = Math.round(emailsLast2Hours / 2);

    return {
      totalProcessed: totalSuccess,
      errorRate: Math.round(errorRate * 10) / 10,
      emailsPerHour,
      emailsToday: successToday,
      errorsToday,
    };
  } catch (error) {
    // Error reading email metrics
    return {
      totalProcessed: 0,
      errorRate: 0,
      emailsPerHour: 0,
      emailsToday: 0,
      errorsToday: 0,
    };
  }
}

async function getPM2Status() {
  try {
    // pm2 jlist é seguro pois não usa input do usuário
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout) as PM2Process[];
    const mockMailApi = processes.find((p) => p.name === 'mockmail-api');

    if (mockMailApi) {
      const uptimeMs = mockMailApi.pm2_env.pm_uptime;
      const uptime = Date.now() - uptimeMs;
      const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
      const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

      return {
        status: mockMailApi.pm2_env.status,
        uptime: `${days}d ${hours}h ${minutes}m`,
        memory: mockMailApi.pm2_env.memory,
        cpu: mockMailApi.pm2_env.cpu,
        restarts: mockMailApi.pm2_env.restart_time,
      };
    }

    return null;
  } catch (error) {
    // Error getting PM2 status
    return null;
  }
}

async function getSystemStatus() {
  try {
    // Comandos fixos sem input do usuário - seguros
    const { stdout: pm2Status } = await execAsync('pm2 jlist');
    const processes = JSON.parse(pm2Status) as PM2Process[];
    const pm2Running = processes.some((p) => p.name === 'mockmail-api' && p.pm2_env.status === 'online');

    // Verificar Python processor de forma segura
    const { stdout: pythonStatus } = await execAsync('pgrep -f email_processor.py || echo "0"');
    const pythonRunning = pythonStatus.trim() !== '0' && pythonStatus.trim() !== '';

    if (pm2Running && pythonRunning) {
      return 'online';
    } else if (pm2Running || pythonRunning) {
      return 'warning';
    } else {
      return 'error';
    }
  } catch (error) {
    // Error checking system status
    return 'error';
  }
}

async function getMongoDBStats() {
  try {
    // Usar API HTTP ao invés de shell command para MongoDB
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/mail/boxes-by-user`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        users: data.summary?.totalUsers || 0,
        emailBoxes: data.summary?.totalBoxes || 0,
      };
    }

    return { users: 0, emailBoxes: 0 };
  } catch (error) {
    // Error getting MongoDB stats
    return { users: 0, emailBoxes: 0 };
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    if (!cookieStore.get('mockmail_access_token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [emailMetrics, pm2Status, systemStatus, mongoStats] = await Promise.all([
      getEmailMetrics(),
      getPM2Status(),
      getSystemStatus(),
      getMongoDBStats(),
    ]);

    const metrics: SystemMetrics = {
      emailsProcessed: emailMetrics.totalProcessed,
      emailsPerHour: emailMetrics.emailsPerHour,
      emailsToday: emailMetrics.emailsToday,
      errorsToday: emailMetrics.errorsToday,
      errorRate: emailMetrics.errorRate,
      uptime: pm2Status?.uptime || '0h 0m',
      activeUsers: mongoStats.users,
      totalEmailBoxes: mongoStats.emailBoxes,
      systemStatus: systemStatus as 'online' | 'warning' | 'error',
      lastUpdate: new Date().toISOString(),
      pm2Status,
      diskUsage: null,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    // Error fetching metrics
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
