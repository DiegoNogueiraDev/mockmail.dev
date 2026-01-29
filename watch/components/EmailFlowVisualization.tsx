import React from 'react';
import { EmailStatus, EmailStep, EmailStepStatus } from '@/types/email';
import { CheckCircle, XCircle, Clock, AlertTriangle, ArrowRight, Mail, Database, Search, Cpu, Server } from 'lucide-react';
import { format } from 'date-fns';

interface EmailFlowVisualizationProps {
  emailStatus: EmailStatus;
  className?: string;
}

const EmailFlowVisualization: React.FC<EmailFlowVisualizationProps> = ({ 
  emailStatus, 
  className = '' 
}) => {
  
  const getStatusIcon = (status: EmailStepStatus) => {
    const iconProps = { size: 24 };
    
    switch (status) {
      case EmailStepStatus.SUCCESS:
        return <CheckCircle {...iconProps} className="text-green-500" />;
      case EmailStepStatus.ERROR:
        return <XCircle {...iconProps} className="text-red-500" />;
      case EmailStepStatus.WARNING:
        return <AlertTriangle {...iconProps} className="text-yellow-500" />;
      case EmailStepStatus.PENDING:
      case EmailStepStatus.SKIPPED:
        return <Clock {...iconProps} className="text-gray-400" />;
      default:
        return <Clock {...iconProps} className="text-gray-400" />;
    }
  };

  const getStepIcon = (stepId: string) => {
    const iconProps = { size: 20 };
    
    switch (stepId) {
      case 'received':
        return <Mail {...iconProps} />;
      case 'python_gateway':
        return <Cpu {...iconProps} />;
      case 'api_processing':
        return <Server {...iconProps} />;
      case 'database_storage':
        return <Database {...iconProps} />;
      case 'search_index':
        return <Search {...iconProps} />;
      default:
        return <Mail {...iconProps} />;
    }
  };

  const getStatusColor = (status: EmailStepStatus) => {
    switch (status) {
      case EmailStepStatus.SUCCESS:
        return 'bg-green-50 border-green-200';
      case EmailStepStatus.ERROR:
        return 'bg-red-50 border-red-200';
      case EmailStepStatus.WARNING:
        return 'bg-yellow-50 border-yellow-200';
      case EmailStepStatus.PENDING:
      case EmailStepStatus.SKIPPED:
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    
    try {
      return format(new Date(timestamp), 'dd/MM/yyyy HH:mm:ss');
    } catch {
      return timestamp;
    }
  };

  const getOverallStatusBadge = (status: EmailStepStatus) => {
    const badgeClasses: Record<EmailStepStatus, string> = {
      [EmailStepStatus.SUCCESS]: 'bg-green-100 text-green-800 border-green-200',
      [EmailStepStatus.ERROR]: 'bg-red-100 text-red-800 border-red-200',
      [EmailStepStatus.WARNING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      [EmailStepStatus.PENDING]: 'bg-gray-100 text-gray-800 border-gray-200',
      [EmailStepStatus.SKIPPED]: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    const statusLabels: Record<EmailStepStatus, string> = {
      [EmailStepStatus.SUCCESS]: 'Processado com Sucesso',
      [EmailStepStatus.ERROR]: 'Erro no Processamento',
      [EmailStepStatus.WARNING]: 'Processado com Avisos',
      [EmailStepStatus.PENDING]: 'Processamento Pendente',
      [EmailStepStatus.SKIPPED]: 'Etapa Ignorada',
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${badgeClasses[status]}`}>
        {getStatusIcon(status)}
        <span className="ml-2">{statusLabels[status]}</span>
      </span>
    );
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 p-6 ${className}`}>
      {/* Header do Email */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {emailStatus.subject}
            </h3>
            <div className="mt-1 flex items-center text-sm text-gray-600">
              <span className="font-medium">De:</span>
              <span className="ml-1 truncate">{emailStatus.from}</span>
            </div>
            <div className="mt-1 flex items-center text-sm text-gray-600">
              <span className="font-medium">Para:</span>
              <span className="ml-1 truncate">{emailStatus.to}</span>
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {formatTimestamp(emailStatus.timestamp)}
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            {getOverallStatusBadge(emailStatus.currentStatus)}
          </div>
        </div>
      </div>

      {/* Fluxo de Processamento */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          Fluxo de Processamento
        </h4>

        <div className="relative">
          {emailStatus.steps.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Linha conectora */}
              {index < emailStatus.steps.length - 1 && (
                <div className="absolute left-6 top-16 w-0.5 h-8 bg-gray-200"></div>
              )}

              {/* Card do Step */}
              <div className={`relative flex items-start space-x-4 p-4 rounded-lg border ${getStatusColor(step.status)}`}>
                {/* Ícone do Status */}
                <div className="flex-shrink-0">
                  {getStatusIcon(step.status)}
                </div>

                {/* Conteúdo do Step */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    {getStepIcon(step.id)}
                    <h5 className="text-sm font-semibold text-gray-900">
                      {step.name}
                    </h5>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {step.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="space-y-1">
                      {step.timestamp && (
                        <div>
                          <span className="font-medium">Timestamp:</span> {formatTimestamp(step.timestamp)}
                        </div>
                      )}
                      
                      {step.duration !== undefined && (
                        <div>
                          <span className="font-medium">Duração:</span> {step.duration}ms
                        </div>
                      )}
                    </div>

                    {step.error && (
                      <div className="text-red-600 text-xs max-w-xs">
                        <span className="font-medium">Erro:</span> {step.error}
                      </div>
                    )}
                  </div>

                  {/* Detalhes adicionais */}
                  {step.details && Object.keys(step.details).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                          Ver detalhes
                        </summary>
                        <div className="mt-1 bg-gray-50 p-2 rounded text-gray-600">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(step.details, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                {/* Seta para o próximo step */}
                {index < emailStatus.steps.length - 1 && (
                  <div className="absolute -bottom-6 left-6 z-10">
                    <div className="bg-white border border-gray-200 rounded-full p-1">
                      <ArrowRight size={12} className="text-gray-400" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo Final */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            <span className="font-medium">ID do Email:</span> {emailStatus.id}
          </div>
          <div className="text-gray-600">
            Total de passos: {emailStatus.steps.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailFlowVisualization;
