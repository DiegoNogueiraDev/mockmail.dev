'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import {
  User,
  ArrowLeft,
  Mail,
  Inbox,
  Calendar,
  Clock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface UserData {
  _id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'system';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface UserStats {
  totalBoxes: number;
  activeBoxes: number;
  expiredBoxes: number;
  totalEmails: number;
}

interface RecentBox {
  _id: string;
  address: string;
  emailCount: number;
  expired: boolean;
  expiresAt?: string;
  createdAt: string;
}

interface EmailByDay {
  _id: string;
  count: number;
}

interface UserDetailResponse {
  user: UserData;
  stats: UserStats;
  recentBoxes: RecentBox[];
  emailsByDay: EmailByDay[];
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const userId = params.id as string;

  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserDetails = async () => {
    try {
      const response = await api.get<UserDetailResponse>(`/api/admin/users/${userId}`);
      if (response.success && response.data) {
        setData(response.data);
        setError(null);
      } else {
        setError('Usuário não encontrado');
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Erro ao carregar usuário');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (hasPermission('admin_users')) {
      fetchUserDetails();
    }
  }, [userId, hasPermission]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUserDetails();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'system':
        return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'admin':
        return <ShieldCheck className="w-5 h-5 text-purple-500" />;
      default:
        return <Shield className="w-5 h-5 text-gray-400" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'system':
        return 'bg-red-100 text-red-700';
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDateLabel = (date: string) => {
    const parts = date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return date;
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
        <div className="w-32 h-6 skeleton" />
        <div className="card-brand p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 skeleton rounded-full" />
            <div className="space-y-2">
              <div className="w-48 h-6 skeleton" />
              <div className="w-32 h-4 skeleton" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/system/users"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para usuários
        </Link>
        <div className="card-brand p-8">
          <div className="empty-state">
            <AlertCircle className="empty-state-icon text-red-500" />
            <p className="empty-state-title">{error || 'Erro'}</p>
            <button onClick={handleRefresh} className="btn-brand mt-4">
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { user, stats, recentBoxes, emailsByDay } = data;

  const chartData = emailsByDay.map((item) => ({
    date: item._id,
    emails: item.count,
  }));

  return (
    <div className="space-y-6" data-testid="user-detail-page">
      {/* Back Link */}
      <Link
        href="/admin/system/users"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para usuários
      </Link>

      {/* User Header */}
      <div className="card-brand p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center text-white text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                  {getRoleIcon(user.role)}
                  {user.role}
                </span>
              </div>
              <p className="text-gray-500">{user.email}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Cadastro: {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                </span>
                {user.lastLogin && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Último login: {new Date(user.lastLogin).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-brand p-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4">
            <Inbox className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-gray-600">Total de Caixas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalBoxes}</p>
        </div>
        <div className="card-brand p-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-gray-600">Caixas Ativas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeBoxes}</p>
        </div>
        <div className="card-brand p-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4">
            <XCircle className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-gray-600">Caixas Expiradas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.expiredBoxes}</p>
        </div>
        <div className="card-brand p-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-gray-600">Total de Emails</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalEmails}</p>
        </div>
      </div>

      {/* Email Activity Chart */}
      {chartData.length > 0 && (
        <div className="card-brand p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Atividade de Emails (7 dias)</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorUserEmails" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                  labelFormatter={(label) => formatDateLabel(String(label))}
                />
                <Area
                  type="monotone"
                  dataKey="emails"
                  name="Emails"
                  stroke="#8b5cf6"
                  fillOpacity={1}
                  fill="url(#colorUserEmails)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Boxes */}
      <div className="card-brand">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Caixas Recentes</h2>
        </div>
        {recentBoxes.length === 0 ? (
          <div className="empty-state py-12">
            <Inbox className="empty-state-icon" />
            <p className="empty-state-title">Nenhuma caixa</p>
            <p className="empty-state-description">
              Este usuário ainda não criou nenhuma caixa
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentBoxes.map((box) => (
              <div
                key={box._id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 font-mono text-sm">
                      {box.address}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {box.emailCount} emails
                      </span>
                      <span>
                        Criada em {new Date(box.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
                {box.expired ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    <XCircle className="w-3 h-3" />
                    Expirada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    Ativa
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
