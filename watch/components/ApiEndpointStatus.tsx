'use client';

import { useState, useEffect } from 'react';
import { Zap, CheckCircle, XCircle, Clock } from 'lucide-react';

interface EndpointStatus {
  name: string;
  path: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: string;
  uptime: number;
}

export default function ApiEndpointStatus() {
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    {
      name: 'Mail Process',
      path: '/api/mail/process',
      status: 'healthy',
      responseTime: 45,
      lastCheck: new Date().toISOString(),
      uptime: 99.2
    },
    {
      name: 'Authentication',
      path: '/api/auth/login',
      status: 'healthy',
      responseTime: 28,
      lastCheck: new Date().toISOString(),
      uptime: 99.8
    },
    {
      name: 'Latest Email',
      path: '/api/mail/latest/:address',
      status: 'healthy',
      responseTime: 67,
      lastCheck: new Date().toISOString(),
      uptime: 99.5
    },
    {
      name: 'Health Check',
      path: '/health',
      status: 'degraded',
      responseTime: 156,
      lastCheck: new Date().toISOString(),
      uptime: 95.3
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'down':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getResponseTimeColor = (time: number) => {
    if (time < 50) return 'text-green-600';
    if (time < 100) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Zap className="w-5 h-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">
            Status dos Endpoints
          </h3>
        </div>
      </div>
      
      <div className="space-y-4">
        {endpoints.map((endpoint, index) => (
          <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-3">
              {getStatusIcon(endpoint.status)}
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  {endpoint.name}
                </h4>
                <p className="text-xs text-gray-500 font-mono">
                  {endpoint.path}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className={`text-sm font-medium ${getResponseTimeColor(endpoint.responseTime)}`}>
                    {endpoint.responseTime}ms
                  </p>
                  <p className="text-xs text-gray-500">response</p>
                </div>
                
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {endpoint.uptime}%
                  </p>
                  <p className="text-xs text-gray-500">uptime</p>
                </div>
                
                <div className="text-right">
                  <span className={`text-xs font-medium capitalize ${getStatusColor(endpoint.status)}`}>
                    {endpoint.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="font-medium text-gray-900">Avg Response</p>
            <p className="text-gray-600">74ms</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Success Rate</p>
            <p className="text-gray-600">98.4%</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Requests/min</p>
            <p className="text-gray-600">145</p>
          </div>
        </div>
      </div>
    </div>
  );
}
