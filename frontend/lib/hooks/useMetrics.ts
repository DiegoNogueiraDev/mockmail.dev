import { useState, useEffect, useCallback } from 'react';

export interface SystemMetrics {
  emailsProcessed: number;
  emailsPerHour: number;
  emailsToday: number;
  errorsToday: number;
  errorRate: number;
  uptime: string;
  activeUsers: number;
  totalEmailBoxes: number;
  systemStatus: 'online' | 'warning' | 'error';
  lastUpdate: string;
  pm2Status: {
    status: string;
    uptime: string;
    memory?: number;
    cpu?: number;
    restarts?: number;
  } | null;
  diskUsage: Record<string, unknown> | null;
}

export interface ErrorEntry {
  timestamp: string;
  type: 'error' | 'warning' | 'critical';
  message: string;
  source: string;
  count: number;
}

export interface ErrorsResponse {
  errors: ErrorEntry[];
  summary: {
    total: number;
    byType: {
      error: number;
      warning: number;
      critical: number;
    };
  };
  lastUpdate: string;
}

export interface ChartDataPoint {
  hour: string;
  success: number;
  errors: number;
  timestamp: string;
}

export interface ChartDataResponse {
  data: ChartDataPoint[];
  summary: {
    totalSuccess: number;
    totalErrors: number;
    totalEmails: number;
    successRate: number;
  };
  lastUpdate: string;
}

export function useMetrics(refreshInterval = 30000) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  return { metrics, loading, error, refetch: fetchMetrics };
}

export function useErrors(refreshInterval = 60000) {
  const [errors, setErrors] = useState<ErrorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchErrors = useCallback(async () => {
    try {
      const response = await fetch('/api/errors');
      if (!response.ok) {
        throw new Error('Failed to fetch errors');
      }
      const data = await response.json();
      setErrors(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchErrors, refreshInterval]);

  return { errors, loading, error, refetch: fetchErrors };
}

export function useChartData(refreshInterval = 120000) {
  const [chartData, setChartData] = useState<ChartDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = useCallback(async () => {
    try {
      const response = await fetch('/api/chart-data');
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }
      const data = await response.json();
      setChartData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChartData();
    const interval = setInterval(fetchChartData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchChartData, refreshInterval]);

  return { chartData, loading, error, refetch: fetchChartData };
}

export interface DailyStats {
  date: string;
  emailsProcessed: number;
  emailsErrors: number;
  successRate: number;
}

export interface DailyStatsResponse {
  today: DailyStats;
  yesterday: DailyStats;
  last7Days: DailyStats[];
  last30Days: DailyStats[];
  summary: {
    totalEmailsLast7Days: number;
    totalErrorsLast7Days: number;
    avgSuccessRateLast7Days: number;
  };
  lastUpdate: string;
}

export function useDailyStats(refreshInterval = 300000) { // 5 minutos
  const [dailyStats, setDailyStats] = useState<DailyStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDailyStats = useCallback(async () => {
    try {
      const response = await fetch('/api/daily-stats');
      if (!response.ok) {
        throw new Error('Failed to fetch daily stats');
      }
      const data = await response.json();
      setDailyStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyStats();
    const interval = setInterval(fetchDailyStats, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchDailyStats, refreshInterval]);

  return { dailyStats, loading, error, refetch: fetchDailyStats };
}
