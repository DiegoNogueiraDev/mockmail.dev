'use client';

import React from 'react';
import { Server, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface SystemComponent {
  name: string;
  status: 'online' | 'warning' | 'error';
  description: string;
}

interface SystemStatusProps {
  apiStatus: string;
  emailProcessorStatus: string;
  mongoStatus: string;
  haproxyStatus: string;
}

export default function SystemStatus({
  apiStatus,
  emailProcessorStatus,
  mongoStatus,
  haproxyStatus
}: SystemStatusProps) {
  const components: SystemComponent[] = [
    {
      name: 'MockMail API',
      status: apiStatus as 'online' | 'warning' | 'error',
      description: apiStatus === 'online' ? 'API funcionando normalmente' : 'Problemas detectados na API'
    },
    {
      name: 'Email Processor',
      status: emailProcessorStatus as 'online' | 'warning' | 'error',
      description: emailProcessorStatus === 'online' ? 'Processador Python ativo' : 'Processador com problemas'
    },
    {
      name: 'MongoDB',
      status: mongoStatus as 'online' | 'warning' | 'error',
      description: mongoStatus === 'online' ? 'Base de dados operacional' : 'Problemas na base de dados'
    },
    {
      name: 'HAProxy',
      status: haproxyStatus as 'online' | 'warning' | 'error',
      description: haproxyStatus === 'online' ? 'Load balancer ativo' : 'Problemas no load balancer'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex items-center mb-4">
          <Server className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
        </div>
        
        <div className="space-y-3">
          {components.map((component, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getStatusColor(component.status)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {getStatusIcon(component.status)}
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {component.name}
                    </p>
                    <p className="text-xs text-gray-600">
                      {component.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    component.status === 'online' 
                      ? 'bg-green-100 text-green-800'
                      : component.status === 'warning'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {component.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
