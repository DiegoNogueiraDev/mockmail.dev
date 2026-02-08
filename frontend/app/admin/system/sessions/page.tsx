'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import {
  Users,
  LogIn,
  LogOut,
  Clock,
  RefreshCw,
  AlertCircle,
  Monitor,
  Smartphone,
  Globe,
  Shield,
  XCircle,
  CheckCircle,
  Timer,
  Ban,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface DeviceInfo {
  browser?: string;
  os?: string;
  device?: string;
}

interface Session {
  id: string;
  user: UserInfo | null;
  loginAt: string;
  logoutAt: string | null;
  status: 'active' | 'logged_out' | 'expired' | 'revoked';
  ipAddress: string | null;
  deviceInfo: DeviceInfo;
  lastActivityAt: string;
  expiresAt: string;
}

type StatusFilter = 'all' | 'active' | 'logged_out' | 'expired' | 'revoked';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Ativa', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="w-4 h-4" /> },
  logged_out: { label: 'Logout', color: 'bg-gray-100 text-gray-700', icon: <LogOut className="w-4 h-4" /> },
  expired: { label: 'Expirada', color: 'bg-orange-100 text-orange-700', icon: <Timer className="w-4 h-4" /> },
  revoked: { label: 'Revogada', color: 'bg-red-100 text-red-700', icon: <Ban className="w-4 h-4" /> },
};

export default function AdminSessionsPage() {
  const { hasPermission } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [activeSessions, setActiveSessions] = useState(0);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSessions = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await api.get(`/api/admin/sessions?${params.toString()}`) as unknown as {
        success: boolean;
        data: Session[];
        pagination: { page: number; limit: number; total: number; totalPages: number; };
        stats: { activeSessions: number; };
      };
      if (response.success && response.data) {
        setSessions(response.data);
        setPagination(response.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        setActiveSessions(response.stats?.activeSessions || 0);
        setError(null);
      } else {
        setError('Erro ao carregar sessões');
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Falha ao carregar sessões');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRefresh = () => {
    fetchSessions(true);
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Tem certeza que deseja revogar esta sessão? O usuário será desconectado.')) {
      return;
    }

    setRevoking(sessionId);
    try {
      const response = await api.post(`/api/admin/sessions/${sessionId}/revoke`) as { success: boolean };
      if (response.success) {
        fetchSessions();
      } else {
        setError('Erro ao revogar sessão');
      }
    } catch (err) {
      console.error('Error revoking session:', err);
      setError('Falha ao revogar sessão');
    } finally {
      setRevoking(null);
    }
  };

  const handleExpireOld = async () => {
    try {
      setRefreshing(true);
      const response = await api.post('/api/admin/sessions/expire-old') as { success: boolean };
      if (response.success) {
        fetchSessions();
      }
    } catch (err) {
      console.error('Error expiring sessions:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const getDeviceIcon = (device?: string) => {
    if (device === 'Mobile') return <Smartphone className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
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
        <div className="card-brand">
          <div className="p-4 border-b border-gray-200">
            <div className="w-64 h-10 skeleton" />
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 skeleton rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="w-48 h-5 skeleton" />
                  <div className="w-32 h-4 skeleton" />
                </div>
                <div className="w-20 h-6 skeleton rounded-full" />
              </div>
            ))}
          </div>
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
      name: 'Usuários Online',
      value: activeSessions,
      icon: Users,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      name: 'Total de Sessões',
      value: pagination.total,
      icon: LogIn,
      color: 'from-blue-500 to-blue-600',
    },
    {
      name: 'Sessões Ativas',
      value: sessions.filter(s => s.status === 'active').length,
      icon: Shield,
      color: 'from-purple-500 to-purple-600',
    },
    {
      name: 'Páginas',
      value: `${page} / ${pagination.totalPages || 1}`,
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      isText: true,
    },
  ];

  return (
    <div className="space-y-6" data-testid="admin-sessions-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sessões de Usuários</h1>
          <p className="text-gray-600 mt-1">
            Monitore logins, logouts e sessões ativas dos usuários
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExpireOld}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
          >
            <Timer className="w-4 h-4" />
            Expirar Antigas
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
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
                {stat.isText ? stat.value : (stat.value as number).toLocaleString('pt-BR')}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'logged_out', 'expired', 'revoked'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-gradient-to-r from-[#e2498a] to-[#5636d1] text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {status === 'all' ? 'Todas' : statusConfig[status]?.label || status}
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      <div className="card-brand">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Login
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Logout
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Dispositivo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  IP
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16">
                    <div className="empty-state">
                      <LogIn className="empty-state-icon" />
                      <p className="empty-state-title">Nenhuma sessão encontrada</p>
                      <p className="empty-state-description">
                        {statusFilter !== 'all'
                          ? `Não há sessões com status "${statusConfig[statusFilter]?.label || statusFilter}"`
                          : 'Ainda não há sessões registradas'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      {session.user ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center text-white font-medium">
                            {session.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{session.user.name}</p>
                            <p className="text-sm text-gray-500">{session.user.email}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              session.user.role === 'admin' || session.user.role === 'system'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {session.user.role}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">Usuário removido</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        statusConfig[session.status]?.color || 'bg-gray-100 text-gray-700'
                      }`}>
                        {statusConfig[session.status]?.icon}
                        {statusConfig[session.status]?.label || session.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <LogIn className="w-4 h-4 text-emerald-500" />
                        <div>
                          <p className="text-gray-900">
                            {format(new Date(session.loginAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(session.loginAt), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {session.logoutAt ? (
                        <div className="flex items-center gap-2 text-sm">
                          <LogOut className="w-4 h-4 text-red-500" />
                          <div>
                            <p className="text-gray-900">
                              {format(new Date(session.logoutAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(session.logoutAt), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        {getDeviceIcon(session.deviceInfo?.device)}
                        <div>
                          <p className="text-gray-900">{session.deviceInfo?.browser || 'Desconhecido'}</p>
                          <p className="text-xs text-gray-500">{session.deviceInfo?.os || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700 font-mono text-xs">
                          {session.ipAddress || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {session.status === 'active' && (
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={revoking === session.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          {revoking === session.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Mostrando {sessions.length} de {pagination.total} sessões
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary btn-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="btn-secondary btn-sm disabled:opacity-50"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
