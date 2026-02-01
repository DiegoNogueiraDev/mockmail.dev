export interface EmailStatus {
  id: string;
  from: string;
  to: string;
  subject: string;
  timestamp: string;
  steps: EmailStep[];
  currentStatus: EmailStepStatus;
}

export interface EmailStep {
  id: string;
  name: string;
  description: string;
  status: EmailStepStatus;
  timestamp?: string;
  duration?: number;
  error?: string;
  details?: Record<string, any>;
}

export enum EmailStepStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  SKIPPED = 'skipped'
}

export interface EmailTrackingFlow {
  received: EmailStep;
  pythonGateway: EmailStep;
  apiProcessing: EmailStep;
  databaseStorage: EmailStep;
  searchIndex: EmailStep;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface EmailTrackingRequest {
  email: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
  days?: number;
}

export interface EmailTrackingResponse {
  success: boolean;
  data: EmailStatus[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  message?: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    days?: number;
  };
}

export interface LogParserOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
}
