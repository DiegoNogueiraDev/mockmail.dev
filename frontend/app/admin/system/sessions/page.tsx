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

interface SessionsResponse {
  success: boolean;
  data: Session[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    activeSessions: number;
  };
}

type StatusFilter = 'all' | 'active' | 'logged_out' | 'expired' | 'revoked';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Ativa', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="w-4 h-4" /> },
  logged_out: { label: 'Logout', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: <LogOut className="w-4 h-4" /> },
  expired: { label: 'Expirada', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Timer className="w-4 h-4" /> },
  revoked: { label: 'Revogada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <Ban className="w-4 h-4" /> },
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

      const response = await api.get<SessionsResponse>(`/api/admin/sessions?${params.toString()}`);
      if (response.success && response.data) {
        setSessions(response.data.data);
        setPagination(response.data.pagination);
        setActiveSessions(response.data.stats.activeSessions);
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
      const response = await api.post(`/api/admin/sessions/${sessionId}/revoke`);
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
      const response = await api.post('/api/admin/sessions/expire-old');
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
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5" />
            <span>Você não tem permissão para acessar esta página.</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sessões de Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Monitore logins, logouts e sessões ativas dos usuários
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExpireOld}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
          >
            <Timer className="w-4 h-4" />
            Expirar Antigas
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Usuários Online</p>
              <p className="text-2xl font-bold text-foreground">{activeSessions}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <LogIn className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Sessões</p>
              <p className="text-2xl font-bold text-foreground">{pagination.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sessões Ativas</p>
              <p className="text-2xl font-bold text-foreground">
                {sessions.filter(s => s.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Páginas</p>
              <p className="text-2xl font-bold text-foreground">
                {page} / {pagination.totalPages || 1}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'logged_out', 'expired', 'revoked'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            {status === 'all' ? 'Todas' : statusConfig[status]?.label || status}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Login
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Logout
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Dispositivo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  IP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma sessão encontrada
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      {session.user ? (
                        <div>
                          <p className="font-medium text-foreground">{session.user.name}</p>
                          <p className="text-sm text-muted-foreground">{session.user.email}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            session.user.role === 'admin' || session.user.role === 'system'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}>
                            {session.user.role}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Usuário removido</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        statusConfig[session.status]?.color || 'bg-gray-100 text-gray-800'
                      }`}>
                        {statusConfig[session.status]?.icon}
                        {statusConfig[session.status]?.label || session.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <LogIn className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-foreground">
                            {format(new Date(session.loginAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(session.loginAt), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {session.logoutAt ? (
                        <div className="flex items-center gap-2 text-sm">
                          <LogOut className="w-4 h-4 text-red-500" />
                          <div>
                            <p className="text-foreground">
                              {format(new Date(session.logoutAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(session.logoutAt), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        {getDeviceIcon(session.deviceInfo?.device)}
                        <div>
                          <p className="text-foreground">{session.deviceInfo?.browser || 'Desconhecido'}</p>
                          <p className="text-xs text-muted-foreground">{session.deviceInfo?.os || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground font-mono text-xs">
                          {session.ipAddress || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {session.status === 'active' && (
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={revoking === session.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Mostrando {sessions.length} de {pagination.total} sessões
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm bg-muted rounded hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 text-sm bg-muted rounded hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
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
