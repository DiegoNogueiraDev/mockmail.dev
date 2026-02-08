'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

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

export default function AdminStatsPage() {
  const { hasPermission } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    if (hasPermission('admin_users')) {
      fetchStats();
    }
  }, [hasPermission]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
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

  const historyCards = [
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

      {/* History Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Arquivamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {historyCards.map((stat) => {
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
