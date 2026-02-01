'use client';

import React from 'react';
import { Calendar, TrendingUp, TrendingDown, Mail, AlertTriangle } from 'lucide-react';
import { formatToBrazilianTime } from '../lib/utils/dateFormatter';

interface DailyStats {
  date: string;
  emailsProcessed: number;
  emailsErrors: number;
  successRate: number;
}

interface DailyStatsCardProps {
  today: DailyStats;
  yesterday: DailyStats;
  last7Days: DailyStats[];
}

const DailyStatsCard = ({ today, yesterday, last7Days }: DailyStatsCardProps) => {
  const formatDate = (dateStr: string) => {
    // Usa o formatador brasileiro com timezone correto
    return formatToBrazilianTime(dateStr, { includeTime: false, shortFormat: true });
  };

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return { direction: 'up', percentage: 0 };
    const diff = ((current - previous) / previous) * 100;
    return { 
      direction: diff >= 0 ? 'up' : 'down', 
      percentage: Math.abs(Math.round(diff)) 
    };
  };

  const emailsTrend = getTrend(today.emailsProcessed, yesterday.emailsProcessed);
  const errorsTrend = getTrend(today.emailsErrors, yesterday.emailsErrors);

  const totalLast7Days = last7Days.reduce((sum, day) => sum + day.emailsProcessed, 0);
  const avgPerDay = Math.round(totalLast7Days / 7);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <Calendar className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Estatísticas Diárias</h3>
      </div>

      {/* Estatísticas de Hoje vs Ontem */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Hoje</p>
              <p className="text-2xl font-bold text-blue-800">{today.emailsProcessed.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-blue-600">emails processados</p>
            </div>
            <div className="text-right">
              <div className={`flex items-center text-xs ${
                emailsTrend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {emailsTrend.direction === 'up' ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {emailsTrend.percentage}%
              </div>
              <p className="text-xs text-gray-500 mt-1">vs ontem</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-red-600">{today.emailsErrors} erros</span>
            <span className="text-green-600">{today.successRate}% sucesso</span>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Ontem</p>
              <p className="text-2xl font-bold text-gray-800">{yesterday.emailsProcessed.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-600">emails processados</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-red-600">{yesterday.emailsErrors} erros</span>
            <span className="text-green-600">{yesterday.successRate}% sucesso</span>
          </div>
        </div>
      </div>

      {/* Resumo dos Últimos 7 Dias */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Últimos 7 dias</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{totalLast7Days.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-gray-600">total processados</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{avgPerDay}</p>
            <p className="text-xs text-gray-600">média/dia</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {Math.round(last7Days.reduce((sum, day) => sum + day.successRate, 0) / 7)}%
            </p>
            <p className="text-xs text-gray-600">taxa de sucesso</p>
          </div>
        </div>
        
        {/* Mini gráfico dos últimos 7 dias */}
        <div className="mt-4">
          <div className="flex items-end justify-between h-16 space-x-1">
            {last7Days.slice().reverse().map((day, index) => {
              const height = Math.max((day.emailsProcessed / Math.max(...last7Days.map(d => d.emailsProcessed))) * 100, 5);
              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div 
                    className="bg-blue-200 rounded-t w-full min-h-[4px]" 
                    style={{ height: `${height}%` }}
                    title={`${formatDate(day.date)}: ${day.emailsProcessed} emails`}
                  ></div>
                  <span className="text-[10px] text-gray-500 mt-1">
                    {formatDate(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyStatsCard;
