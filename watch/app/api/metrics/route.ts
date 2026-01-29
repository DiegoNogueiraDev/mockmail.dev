import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

async function getEmailMetrics() {
  try {
    // Contar emails processados com sucesso (total)
    const { stdout: successCount } = await execAsync(
      'grep -c "E-mail processado com sucesso" /var/log/mockmail/email_processor.log || echo "0"'
    );
    
    // Contar erros 400 (total)
    const { stdout: errorCount } = await execAsync(
      'grep -c "400 Client Error" /var/log/mockmail/email_processor.log || echo "0"'
    );
    
    const totalSuccess = parseInt(successCount.trim()) || 0;
    const totalErrors = parseInt(errorCount.trim()) || 0;
    const totalEmails = totalSuccess + totalErrors;
    
    // Calcular taxa de erro
    const errorRate = totalEmails > 0 ? (totalErrors / totalEmails) * 100 : 0;
    
    // Emails processados hoje
    const today = new Date().toISOString().substring(0, 10);
    const { stdout: successToday } = await execAsync(
      `grep "^${today}" /var/log/mockmail/email_processor.log | grep -c "E-mail processado com sucesso" || echo "0"`
    );
    const { stdout: errorsToday } = await execAsync(
      `grep "^${today}" /var/log/mockmail/email_processor.log | grep -c "400 Client Error" || echo "0"`
    );
    
    // Emails processados nas últimas 2 horas (mais realista que 1 hora)
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const startTime = twoHoursAgo.toISOString().substring(0, 13).replace('T', ' ');
    
    const { stdout: recentEmails } = await execAsync(
      `awk '$0 >= "${startTime}" {print}' /var/log/mockmail/email_processor.log | grep -c "E-mail processado com sucesso" || echo "0"`
    );
    
    // Calcular emails/hora baseado nas últimas 2 horas
    const emailsLast2Hours = parseInt(recentEmails.trim()) || 0;
    const emailsPerHour = Math.round(emailsLast2Hours / 2);
    
    return {
      totalProcessed: totalSuccess,
      errorRate: Math.round(errorRate * 10) / 10,
      emailsPerHour,
      emailsToday: parseInt(successToday.trim()) || 0,
      errorsToday: parseInt(errorsToday.trim()) || 0,
    };
  } catch (error) {
    console.error('Erro ao obter métricas de email:', error);
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
    console.error('Erro ao obter status PM2:', error);
    return null;
  }
}

async function getSystemStatus() {
  try {
    // Verificar se os serviços estão rodando
    const { stdout: pm2Status } = await execAsync('pm2 list | grep mockmail-api | wc -l');
    const { stdout: pythonStatus } = await execAsync('ps aux | grep email_processor.py | grep -v grep | wc -l');
    
    const pm2Running = parseInt(pm2Status.trim()) > 0;
    const pythonRunning = parseInt(pythonStatus.trim()) > 0;
    
    if (pm2Running && pythonRunning) {
      return 'online';
    } else if (pm2Running || pythonRunning) {
      return 'warning';
    } else {
      return 'error';
    }
  } catch (error) {
    console.error('Erro ao verificar status do sistema:', error);
    return 'error';
  }
}

async function getMongoDBStats() {
  try {
    // Contar usuários e caixas de email
    const { stdout: userCount } = await execAsync(
      'mongo --quiet --eval "db.users.countDocuments({})" mockmail || echo "0"'
    );
    
    const { stdout: emailBoxCount } = await execAsync(
      'mongo --quiet --eval "db.emailboxes.countDocuments({})" mockmail || echo "0"'
    );
    
    return {
      users: parseInt(userCount.trim()) || 0,
      emailBoxes: parseInt(emailBoxCount.trim()) || 0,
    };
  } catch (error) {
    console.error('Erro ao obter stats do MongoDB:', error);
    return {
      users: 0,
      emailBoxes: 0,
    };
  }
}

export async function GET() {
  try {
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
    console.error('Erro ao buscar métricas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
