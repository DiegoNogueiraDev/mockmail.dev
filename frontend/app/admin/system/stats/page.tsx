'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import {
  BarChart3,
  Users,
  Inbox,
  Mail,
  TrendingUp,
  Clock,
  RefreshCw,
  AlertCircle,
  Archive,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface PlatformStats {
  totalUsers: number;
  totalBoxes: number;
  totalEmails: number;
  activeBoxes: number;
  expiredBoxes: number;
}

interface HistoryStats {
  totalArchived: number;
  totalArchivedEmails: number;
  last24h: number;
  last7d: number;
}

interface StatsData {
  platform: PlatformStats;
  history: HistoryStats;
  usersByRole: Record<string, number>;
}

interface ChartDataPoint {
  date: string;
  emails: number;
  boxes: number;
  users: number;
}

interface ChartResponse {
  period: string;
  dateFormat: string;
  startDate: string;
  chartData: ChartDataPoint[];
  totals: {
    emails: number;
    boxes: number;
    users: number;
  };
}

type Period = 'today' | 'week' | 'lastWeek' | 'month' | 'year';

const periodLabels: Record<Period, string> = {
  today: 'Hoje',
  week: 'Esta Semana',
  lastWeek: 'Semana Passada',
  month: 'Este Mês',
  year: 'Este Ano',
};

export default function AdminStatsPage() {
  const { hasPermission } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [chartData, setChartData] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');

  const fetchStats = async () => {
    try {
      const response = await api.get<StatsData>('/api/admin/stats');
      if (response.success && response.data) {
        setStats(response.data);
        setError(null);
      } else {
        setError('Erro ao carregar estatísticas');
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchChartData = useCallback(async (period: Period) => {
    setChartLoading(true);
    try {
      const response = await api.get<ChartResponse>(`/api/admin/charts?period=${period}`);
      if (response.success && response.data) {
        setChartData(response.data);
      }
    } catch (err) {
      console.error('Error fetching chart data:', err);
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasPermission('admin_users')) {
      fetchStats();
      fetchChartData(selectedPeriod);
    }
  }, [hasPermission, fetchChartData, selectedPeriod]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
    fetchChartData(selectedPeriod);
  };

  const handlePeriodChange = (period: Period) => {
    setSelectedPeriod(period);
  };

  const formatDateLabel = (date: string) => {
    if (!chartData) return date;

    if (chartData.dateFormat === 'hour') {
      return date + 'h';
    } else if (chartData.dateFormat === 'month') {
      const [year, month] = date.split('-');
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return months[parseInt(month) - 1] || date;
    } else {
      // day format - show DD/MM
      const parts = date.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      return date;
    }
  };

  if (!hasPermission('admin_users')) {
    return (
      <div className="card-brand p-8">
        <div className="empty-state">
          <AlertCircle className="empty-state-icon text-red-500" />
          <p className="empty-state-title">Acesso Negado</p>
          <p className="empty-state-description">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="w-48 h-8 skeleton" />
          <div className="w-32 h-10 skeleton" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-brand p-6">
              <div className="w-12 h-12 skeleton rounded-xl mb-4" />
              <div className="w-24 h-4 skeleton mb-2" />
              <div className="w-16 h-8 skeleton" />
            </div>
          ))}
        </div>
        <div className="card-brand p-6">
          <div className="w-full h-80 skeleton" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-brand p-8">
        <div className="empty-state">
          <AlertCircle className="empty-state-icon text-red-500" />
          <p className="empty-state-title">Erro</p>
          <p className="empty-state-description">{error}</p>
          <button onClick={handleRefresh} className="btn-brand mt-4">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total de Usuários',
      value: stats?.platform.totalUsers || 0,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      subtitle: `${stats?.usersByRole?.admin || 0} admins`,
    },
    {
      name: 'Caixas Ativas',
      value: stats?.platform.activeBoxes || 0,
      icon: Inbox,
      color: 'from-emerald-500 to-emerald-600',
      subtitle: `${stats?.platform.totalBoxes || 0} total`,
    },
    {
      name: 'Total de Emails',
      value: stats?.platform.totalEmails || 0,
      icon: Mail,
      color: 'from-purple-500 to-purple-600',
      subtitle: 'na plataforma',
    },
    {
      name: 'Caixas Expiradas',
      value: stats?.platform.expiredBoxes || 0,
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      subtitle: 'aguardando limpeza',
    },
  ];

  return (
    <div className="space-y-6" data-testid="admin-stats-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estatísticas da Plataforma</h1>
          <p className="text-gray-600 mt-1">Visão geral do sistema MockMail</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Platform Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Plataforma</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.name} className="card-brand p-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stat.value.toLocaleString('pt-BR')}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Section */}
      <div className="card-brand p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Atividade por Período</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(periodLabels) as Period[]).map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-gradient-to-r from-[#e2498a] to-[#5636d1] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {periodLabels[period]}
              </button>
            ))}
          </div>
        </div>

        {/* Period Totals */}
        {chartData && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-purple-50 rounded-xl">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Mail className="w-4 h-4" />
                <span className="text-sm font-medium">Emails</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">
                {chartData.totals.emails.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <Inbox className="w-4 h-4" />
                <span className="text-sm font-medium">Caixas</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">
                {chartData.totals.boxes.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Usuários</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {chartData.totals.users.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        )}

        {/* Area Chart */}
        {chartLoading ? (
          <div className="w-full h-80 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : chartData && chartData.chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData.chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBoxes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  labelFormatter={formatDateLabel}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="emails"
                  name="Emails"
                  stroke="#8b5cf6"
                  fillOpacity={1}
                  fill="url(#colorEmails)"
                />
                <Area
                  type="monotone"
                  dataKey="boxes"
                  name="Caixas"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorBoxes)"
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Usuários"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>Sem dados para o período selecionado</p>
            </div>
          </div>
        )}
      </div>

      {/* Bar Chart for Comparison */}
      {chartData && chartData.chartData.length > 0 && (
        <div className="card-brand p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Comparativo Detalhado</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  labelFormatter={formatDateLabel}
                />
                <Legend />
                <Bar dataKey="emails" name="Emails" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="boxes" name="Caixas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="users" name="Usuários" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* History Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Arquivamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              name: 'Registros Arquivados',
              value: stats?.history?.totalArchived || 0,
              icon: Archive,
              color: 'from-gray-500 to-gray-600',
            },
            {
              name: 'Emails Arquivados',
              value: stats?.history?.totalArchivedEmails || 0,
              icon: Mail,
              color: 'from-indigo-500 to-indigo-600',
            },
            {
              name: 'Arquivados (24h)',
              value: stats?.history?.last24h || 0,
              icon: TrendingUp,
              color: 'from-cyan-500 to-cyan-600',
            },
            {
              name: 'Arquivados (7d)',
              value: stats?.history?.last7d || 0,
              icon: BarChart3,
              color: 'from-pink-500 to-pink-600',
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.name} className="card-brand p-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stat.value.toLocaleString('pt-BR')}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Users by Role */}
      <div className="card-brand p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Usuários por Tipo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {['user', 'admin', 'system'].map((role) => (
            <div
              key={role}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
            >
              <span className="font-medium text-gray-700 capitalize">{role}</span>
              <span className="text-lg font-bold text-gray-900">
                {stats?.usersByRole?.[role] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
