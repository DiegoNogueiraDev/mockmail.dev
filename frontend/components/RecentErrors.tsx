'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { ErrorEntry, ErrorsResponse } from '../lib/hooks/useMetrics';
import { formatToBrazilianTime, formatRelativeTime } from '../lib/utils/dateFormatter';

interface RecentErrorsProps {
  errors: ErrorEntry[];
  summary?: ErrorsResponse['summary'];
}

const RecentErrors = ({ errors, summary }: RecentErrorsProps) => {
  const getErrorIcon = (type: ErrorEntry['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'warning':
        return <Info className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getErrorBgColor = (type: ErrorEntry['type']) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'error':
        return 'bg-orange-50 border-orange-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      // Converter o formato "YYYY-MM-DD HH:MM:SS" para um formato que o formatador possa processar
      let dateInput = timestamp;
      
      // Se não tem 'T' ou 'Z', assume que está no formato "YYYY-MM-DD HH:MM:SS" local
      if (!timestamp.includes('T') && !timestamp.includes('Z')) {
        // Converte para ISO format assumindo que já está no timezone local
        dateInput = timestamp.replace(' ', 'T');
      }
      
      return formatToBrazilianTime(dateInput);
    } catch (error) {
      console.error('Erro ao formatar timestamp:', error);
      return timestamp;
    }
  };

  const formatRelativeTimestamp = (timestamp: string) => {
    try {
      let dateInput = timestamp;
      
      // Se não tem 'T' ou 'Z', assume que está no formato "YYYY-MM-DD HH:MM:SS" local
      if (!timestamp.includes('T') && !timestamp.includes('Z')) {
        dateInput = timestamp.replace(' ', 'T');
      }
      
      return formatRelativeTime(dateInput);
    } catch (error) {
      console.error('Erro ao calcular tempo relativo:', error);
      return 'tempo desconhecido';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Errors</h3>
          {summary && (
            <div className="flex space-x-2 text-sm">
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                {summary.byType.critical} Critical
              </span>
              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                {summary.byType.error} Errors
              </span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                {summary.byType.warning} Warnings
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {errors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Info className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No recent errors</p>
              <p className="text-sm">System is running smoothly</p>
            </div>
          ) : (
            errors.slice(0, 10).map((error, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getErrorBgColor(error.type)}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getErrorIcon(error.type)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {error.message}
                      </p>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2" title={formatTimestamp(error.timestamp)}>
                        {formatRelativeTimestamp(error.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-600">
                        Source: {error.source}
                      </p>
                      {error.count > 1 && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                          {error.count}x
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {errors.length > 10 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Showing 10 of {errors.length} errors
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentErrors;
