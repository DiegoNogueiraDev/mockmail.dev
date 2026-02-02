import fs from 'fs';
import path from 'path';
import { EmailStatus, EmailStep, EmailStepStatus, LogEntry } from '../types/emailTracking';

export class LogParser {
  private logsPath: string;

  constructor(logsPath: string = '/var/log/mockmail') {
    this.logsPath = logsPath;
  }

  /**
   * Analisa os logs para um email específico
   */
  async parseEmailLogs(emailAddress: string): Promise<EmailStatus[]> {
    const results: EmailStatus[] = [];
    
    try {
      // Lê o arquivo JSON de emails
      const emailsJsonPath = path.join(this.logsPath, 'emails.json');
      const emailsData = await this.readEmailsJson(emailsJsonPath, emailAddress);

      // Lê os logs do processador Python
      const processorLogs = await this.readProcessorLogs(emailAddress);

      // Lê os logs da API (dashboard)
      const apiLogs = await this.readApiLogs(emailAddress);

      // Combina todos os dados para criar o tracking
      for (const email of emailsData) {
        const status = await this.buildEmailStatus(email, processorLogs, apiLogs);
        results.push(status);
      }

      return results.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    } catch (error) {
      console.error('Erro ao analisar logs:', error);
      throw new Error(`Falha ao processar logs para ${emailAddress}: ${(error as Error).message}`);
    }
  }

  /**
   * Lê e filtra emails do arquivo JSON
   */
  private async readEmailsJson(filePath: string, emailAddress: string): Promise<any[]> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const emails = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(email => email && email.from && email.from.includes(emailAddress));

      return emails;
    } catch (error) {
      console.error('Erro ao ler emails.json:', error);
      return [];
    }
  }

  /**
   * Lê os logs do processador Python
   */
  private async readProcessorLogs(emailAddress: string): Promise<LogEntry[]> {
    try {
      const logPath = path.join(this.logsPath, 'email_processor.log');
      const content = fs.readFileSync(logPath, 'utf-8');
      
      return content
        .split('\n')
        .filter(line => line.includes(emailAddress) || line.includes('processado com sucesso'))
        .map(line => this.parseLogLine(line))
        .filter(entry => entry !== null);
    } catch (error) {
      console.error('Erro ao ler logs do processador:', error);
      return [];
    }
  }

  /**
   * Lê os logs da API
   */
  private async readApiLogs(emailAddress: string): Promise<LogEntry[]> {
    try {
      const logPath = path.join(this.logsPath, 'dashboard-1.log');
      const content = fs.readFileSync(logPath, 'utf-8');
      
      return content
        .split('\n')
        .filter(line => line.includes(emailAddress))
        .map(line => this.parseLogLine(line))
        .filter(entry => entry !== null);
    } catch (error) {
      console.error('Erro ao ler logs da API:', error);
      return [];
    }
  }

  /**
   * Faz parsing de uma linha de log
   */
  private parseLogLine(line: string): LogEntry | null {
    try {
      // Regex para capturar timestamp, level e mensagem
      const logRegex = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*-\s*(\w+)\s*-\s*(.*)/;
      const match = line.match(logRegex);

      if (match) {
        return {
          timestamp: match[1],
          level: match[2],
          message: match[3].trim(),
        };
      }

      // Fallback para outros formatos
      return {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: line.trim(),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Constrói o status completo de um email
   */
  private async buildEmailStatus(
    emailData: any, 
    processorLogs: LogEntry[], 
    apiLogs: LogEntry[]
  ): Promise<EmailStatus> {
    
    const steps: EmailStep[] = [];
    
    // Passo 1: Chegada no servidor
    const receivedStep: EmailStep = {
      id: 'received',
      name: 'Email Received',
      description: 'Email chegou no servidor MockMail',
      status: EmailStepStatus.SUCCESS,
      timestamp: emailData.date,
      duration: 0,
    };
    steps.push(receivedStep);

    // Passo 2: Processamento no Gateway Python
    const pythonProcessing = processorLogs.find(log => 
      log.message.includes('processado com sucesso') && 
      log.message.includes(emailData.subject)
    );

    const pythonStep: EmailStep = {
      id: 'python_gateway',
      name: 'Python Gateway Processing',
      description: 'Processamento pelo gateway Python',
      status: pythonProcessing ? EmailStepStatus.SUCCESS : EmailStepStatus.ERROR,
      timestamp: pythonProcessing?.timestamp,
      error: pythonProcessing ? undefined : 'Não encontrado nos logs do processador',
    };
    steps.push(pythonStep);

    // Passo 3: Processamento pela API
    const apiProcessingStep: EmailStep = {
      id: 'api_processing',
      name: 'API Processing',
      description: 'Processamento pela API MockMail',
      status: emailData.processed_at ? EmailStepStatus.SUCCESS : EmailStepStatus.PENDING,
      timestamp: emailData.processed_at,
    };
    steps.push(apiProcessingStep);

    // Passo 4: Armazenamento em base de dados
    const databaseStep: EmailStep = {
      id: 'database_storage',
      name: 'Database Storage',
      description: 'Armazenamento na base de dados',
      status: emailData.processed_at ? EmailStepStatus.SUCCESS : EmailStepStatus.PENDING,
      timestamp: emailData.processed_at,
    };
    steps.push(databaseStep);

    // Passo 5: Indexação para pesquisa
    const searchIndexStep: EmailStep = {
      id: 'search_index',
      name: 'Search Indexing',
      description: 'Indexação para sistema de busca',
      status: emailData.processed_at ? EmailStepStatus.SUCCESS : EmailStepStatus.WARNING,
      timestamp: emailData.processed_at,
    };
    steps.push(searchIndexStep);

    // Determina o status atual baseado nos passos
    const currentStatus = this.determineCurrentStatus(steps);

    return {
      id: emailData.id,
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      timestamp: emailData.date,
      steps,
      currentStatus,
    };
  }

  /**
   * Determina o status atual baseado nos passos
   */
  private determineCurrentStatus(steps: EmailStep[]): EmailStepStatus {
    const hasError = steps.some(step => step.status === EmailStepStatus.ERROR);
    const hasWarning = steps.some(step => step.status === EmailStepStatus.WARNING);
    const allSuccess = steps.every(step => step.status === EmailStepStatus.SUCCESS);

    if (hasError) return EmailStepStatus.ERROR;
    if (hasWarning) return EmailStepStatus.WARNING;
    if (allSuccess) return EmailStepStatus.SUCCESS;
    
    return EmailStepStatus.PENDING;
  }

  /**
   * Verifica se os arquivos de log existem e são acessíveis
   */
  async validateLogAccess(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const requiredFiles = [
      'emails.json',
      'email_processor.log',
      'dashboard-1.log',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.logsPath, file);
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch (error) {
        errors.push(`Arquivo não acessível: ${filePath}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default LogParser;
