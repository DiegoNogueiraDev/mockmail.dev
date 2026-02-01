'use client';

import Link from "next/link";
import React from 'react';
import MetricCard from './MetricCard';
import EmailMetricsChart from './EmailMetricsChart';
import SystemStatus from './SystemStatus';
import RecentErrors from './RecentErrors';
import ApiEndpointStatus from './ApiEndpointStatus';
import DailyStatsCard from './DailyStatsCard';
import { useMetrics, useErrors, useChartData, useDailyStats } from '../lib/hooks/useMetrics';
import { Activity, Mail, Users, AlertTriangle, Clock, Calendar } from 'lucide-react';

const Dashboard = () => {
  const { metrics, loading: metricsLoading, error: metricsError } = useMetrics();
  const { errors, loading: errorsLoading, error: errorsError } = useErrors();
  const { chartData, loading: chartLoading, error: chartError } = useChartData();
  const { dailyStats, loading: dailyLoading, error: dailyError } = useDailyStats();

  if (metricsLoading || errorsLoading || chartLoading || dailyLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (metricsError || errorsError || chartError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Error loading dashboard data</p>
          <p className="text-gray-500 text-sm mt-2">
            {metricsError || errorsError || chartError}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">MockMail Monitor</h1>
              <p className="text-gray-600 mt-1">Real-time system monitoring and analytics</p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>Last updated: {new Date(metrics?.lastUpdate || '').toLocaleTimeString()}</span>
              <Link href="/boxes" className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">Caixas</Link>
              <Link href="/tracking" className="ml-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors">Tracking</Link>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Emails Processed"
            value={metrics?.emailsProcessed?.toLocaleString() || '0'}
            change={`+${metrics?.emailsPerHour || 0}/hr`}
            trend="up"
            icon={Mail}
            color="blue"
          />
          <MetricCard
            title="Error Rate"
            value={`${metrics?.errorRate || 0}%`}
            change={errors?.summary?.total ? `${errors.summary.total} recent` : 'No errors'}
            trend={metrics?.errorRate && metrics.errorRate > 5 ? 'down' : 'up'}
            icon={AlertTriangle}
            color={metrics?.errorRate && metrics.errorRate > 5 ? 'red' : 'green'}
          />
          <MetricCard
            title="Emails Today"
            value={metrics?.emailsToday?.toString() || '0'}
            change={`${metrics?.errorsToday || 0} errors today`}
            trend={metrics?.errorsToday && metrics?.errorsToday > 0 ? 'down' : 'up'}
            icon={Calendar}
            color="green"
          />
          <MetricCard
            title="System Uptime"
            value={metrics?.uptime || '0h 0m'}
            change={`Status: ${metrics?.systemStatus || 'unknown'}`}
            trend="up"
            icon={Activity}
            color="purple"
          />
        </div>

        {/* Charts, Daily Stats and Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <EmailMetricsChart data={chartData?.data || []} />
          </div>
          <div>
            <SystemStatus
              apiStatus={metrics?.systemStatus === 'online' ? 'online' : 'error'}
              emailProcessorStatus={metrics?.pm2Status?.status === 'online' ? 'online' : 'warning'}
              mongoStatus="online"
              haproxyStatus="online"
            />
          </div>
        </div>

        {/* Daily Stats */}
        {dailyStats && !dailyError && (
          <div className="mb-8">
            <DailyStatsCard 
              today={dailyStats.today}
              yesterday={dailyStats.yesterday}
              last7Days={dailyStats.last7Days}
            />
          </div>
        )}

        {/* Errors and Endpoints */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RecentErrors 
            errors={errors?.errors || []}
            summary={errors?.summary}
          />
          <ApiEndpointStatus />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
