'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/apiClient';
import { BarChart3, RefreshCw } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface UsagePoint {
  date: string;
  count: number;
}

interface UsageChartCardProps {
  days?: number;
}

export default function UsageChartCard({ days = 7 }: UsageChartCardProps) {
  const [data, setData] = useState<UsagePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<UsagePoint[]>(
        `/api/dashboard/usage-history?days=${days}`
      );
      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch usage history:', err);
      setError('Erro ao carregar histórico');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasLoaded && !loading) {
          fetchHistory();
        }
      },
      { root: null, rootMargin: '100px', threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [hasLoaded, loading]);

  const totalEmails = data.reduce((sum, d) => sum + d.count, 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div
      ref={cardRef}
      className="card-brand p-6"
      data-testid="usage-chart-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5636d1] to-[#e2498a] flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Emails Recebidos
            </h3>
            <p className="text-xs text-gray-500">
              Últimos {days} dias
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasLoaded && !loading && (
            <span className="text-2xl font-bold text-gray-900">
              {totalEmails.toLocaleString('pt-BR')}
            </span>
          )}
          {hasLoaded && (
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="text-sm text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Chart area */}
      {loading && !hasLoaded && (
        <div className="h-48 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      )}

      {error && (
        <div className="h-48 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchHistory}
            className="text-sm font-medium text-[#5636d1] hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {hasLoaded && !error && data.length === 0 && (
        <div className="h-48 flex flex-col items-center justify-center gap-2 text-gray-400">
          <BarChart3 className="w-8 h-8" />
          <p className="text-sm">Nenhum dado disponível</p>
        </div>
      )}

      {hasLoaded && !error && data.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5636d1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5636d1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(label) => formatDate(label as string)}
                formatter={(value) => [value, 'Emails']}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#5636d1"
                strokeWidth={2}
                fill="url(#colorEmails)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
