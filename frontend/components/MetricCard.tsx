'use client';

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'purple' | 'indigo';
}

const colorClasses = {
  blue: {
    icon: 'text-blue-600',
    bg: 'bg-blue-50',
    trend: 'text-blue-600'
  },
  green: {
    icon: 'text-green-600',
    bg: 'bg-green-50',
    trend: 'text-green-600'
  },
  red: {
    icon: 'text-red-600',
    bg: 'bg-red-50',
    trend: 'text-red-600'
  },
  purple: {
    icon: 'text-purple-600',
    bg: 'bg-purple-50',
    trend: 'text-purple-600'
  },
  indigo: {
    icon: 'text-indigo-600',
    bg: 'bg-indigo-50',
    trend: 'text-indigo-600'
  }
};

export default function MetricCard({ 
  title, 
  value, 
  change,
  trend,
  icon: Icon, 
  color 
}: MetricCardProps) {
  const colors = colorClasses[color];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`flex items-center justify-center w-12 h-12 ${colors.bg} rounded-lg`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <div className={`flex items-center text-sm ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend === 'up' ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              <span>{change}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
