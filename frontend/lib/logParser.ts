import fs from 'fs';
import path from 'path';
import { EmailStatus, EmailStep, EmailStepStatus, LogEntry, LogParserOptions } from '@/types/email';

export class LogParser {
  private logsPath: string;

  constructor(logsPath: string = '/var/log/mockmail') {
    this.logsPath = logsPath;
  }

  /**
   * Analisa os logs para um email específico com filtros
   */
  async parseEmailLogs(emailAddress: string, options: LogParserOptions = {}): Promise<EmailStatus[]> {
    const {
      startDate,
      endDate,
      limit = 20,
      page = 1
    } = options;

    const results: EmailStatus[] = [];
    
    try {
      // Lê o arquivo JSON de emails com filtros
      const emailsJsonPath = path.join(this.logsPath, 'emails.json');
      const emailsData = await this.readEmailsJson(emailsJsonPath, emailAddress, {
        startDate,
        endDate
      });

      // Lê os logs do processador Python
      const processorLogs = await this.readProcessorLogs(emailAddress);

      // Lê os logs da API (dashboard)  
      const apiLogs = await this.readApiLogs(emailAddress);

      // Combina todos os dados para criar o tracking
      for (const email of emailsData) {
        const status = await this.buildEmailStatus(email, processorLogs, apiLogs);
        results.push(status);
      }

      // Ordenar por timestamp (mais recente primeiro)
      const sortedResults = results.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Aplicar paginação
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      return sortedResults.slice(startIndex, endIndex);

    } catch (error) {
      console.error('Erro ao analisar logs:', error);
      throw new Error(`Falha ao processar logs para ${emailAddress}: ${(error as Error).message}`);
    }
  }

  /**
   * Conta o total de emails (para paginação)
   */
  async getTotalCount(emailAddress: string, options: LogParserOptions = {}): Promise<number> {
    try {
      const emailsJsonPath = path.join(this.logsPath, 'emails.json');
      const emailsData = await this.readEmailsJson(emailsJsonPath, emailAddress, {
        startDate: options.startDate,
        endDate: options.endDate
      });
      
      return emailsData.length;
    } catch (error) {
      console.error('Erro ao contar emails:', error);
      return 0;
    }
  }

  /**
   * Lê e filtra emails do arquivo JSON com filtros de data
   */
  private async readEmailsJson(
    filePath: string, 
    emailAddress: string, 
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<Record<string, unknown>[]> {
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
        .filter(email => {
          if (!email || !email.from) return false;
          
          // Filtrar por email
          if (!email.from.includes(emailAddress)) return false;

          // Filtrar por data se fornecido
          if (options.startDate || options.endDate) {
            const emailDate = new Date(email.date || email.processed_at);
            
            if (options.startDate && emailDate < new Date(options.startDate)) {
              return false;
            }
            
            if (options.endDate && emailDate > new Date(options.endDate)) {
              return false;
            }
          }

          return true;
        });

      return emails;
    } catch (error) {
      console.error('Erro ao ler emails.json:', error);
      return [];
    }
  }

  /**
   * Lê os logs do processador Python (limitado para performance)
   */
  private async readProcessorLogs(emailAddress: string): Promise<LogEntry[]> {
    try {
      const logPath = path.join(this.logsPath, 'email_processor.log');
      
      // Ler apenas as últimas 10000 linhas para performance
      const content = await this.readLastLines(logPath, 10000);
      
      return content
        .split('\n')
        .filter(line => line.includes(emailAddress) || line.includes('processado com sucesso'))
        .map(line => this.parseLogLine(line))
        .filter(entry => entry !== null)
        .slice(-100); // Limitar a 100 entradas mais recentes

    } catch (error) {
      console.error('Erro ao ler logs do processador:', error);
      return [];
    }
  }

  /**
   * Lê os logs da API (limitado)
   */
  private async readApiLogs(emailAddress: string): Promise<LogEntry[]> {
    try {
      const logPath = path.join(this.logsPath, 'dashboard-1.log');
      const content = await this.readLastLines(logPath, 5000);
      
      return content
        .split('\n')
        .filter(line => line.includes(emailAddress))
        .map(line => this.parseLogLine(line))
        .filter(entry => entry !== null)
        .slice(-50); // Limitar a 50 entradas

    } catch (error) {
      console.error('Erro ao ler logs da API:', error);
      return [];
    }
  }

  /**
   * Lê apenas as últimas N linhas de um arquivo para performance
   */
  private async readLastLines(filePath: string, maxLines: number): Promise<string> {
    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Se o arquivo é pequeno, ler tudo
      if (fileSize < 1024 * 1024) { // < 1MB
        return fs.readFileSync(filePath, 'utf-8');
      }

      // Para arquivos grandes, ler do final
      const buffer = Buffer.alloc(Math.min(fileSize, 1024 * 1024 * 5)); // Máximo 5MB
      const fd = fs.openSync(filePath, 'r');
      
      const startPos = Math.max(0, fileSize - buffer.length);
      fs.readSync(fd, buffer, 0, buffer.length, startPos);
      fs.closeSync(fd);

      const content = buffer.toString('utf-8');
      const lines = content.split('\n');
      
      return lines.slice(-maxLines).join('\n');
    } catch (error) {
      console.error('Erro ao ler últimas linhas:', error);
      return '';
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
    } catch {
      return null;
    }
  }

  /**
   * Constrói o status completo de um email
   */
  private async buildEmailStatus(
    emailData: Record<string, unknown>, 
    processorLogs: LogEntry[], 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _apiLogs: LogEntry[]
  ): Promise<EmailStatus> {
    
    const steps: EmailStep[] = [];
    
    // Passo 1: Chegada no servidor
    const receivedStep: EmailStep = {
      id: 'received',
      name: 'Email Received',
      description: 'Email chegou no servidor MockMail',
      status: EmailStepStatus.SUCCESS,
      timestamp: emailData.date as string,
      duration: 0,
    };
    steps.push(receivedStep);

    // Passo 2: Processamento no Gateway Python
    const pythonProcessing = processorLogs.find(log => 
      log.message.includes('processado com sucesso') && 
      (log.message.includes(emailData.subject as string) || log.timestamp)
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
      timestamp: emailData.processed_at as string,
    };
    steps.push(apiProcessingStep);

    // Passo 4: Armazenamento em base de dados
    const databaseStep: EmailStep = {
      id: 'database_storage',
      name: 'Database Storage',
      description: 'Armazenamento na base de dados',
      status: emailData.processed_at ? EmailStepStatus.SUCCESS : EmailStepStatus.PENDING,
      timestamp: emailData.processed_at as string,
    };
    steps.push(databaseStep);

    // Passo 5: Indexação para pesquisa
    const searchIndexStep: EmailStep = {
      id: 'search_index',
      name: 'Search Indexing',
      description: 'Indexação para sistema de busca',
      status: emailData.processed_at ? EmailStepStatus.SUCCESS : EmailStepStatus.WARNING,
      timestamp: emailData.processed_at as string,
    };
    steps.push(searchIndexStep);

    // Determina o status atual baseado nos passos
    const currentStatus = this.determineCurrentStatus(steps);

    return {
      id: emailData.id as string,
      from: emailData.from as string,
      to: emailData.to as string,
      subject: emailData.subject as string,
      timestamp: emailData.date as string,
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
      } catch {
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
