'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import {
  Mail,
  Inbox,
  TrendingUp,
  Clock,
  AlertCircle,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalBoxes: number;
  totalEmails: number;
  emailsToday: number;
  activeWebhooks: number;
  percentChange?: {
    boxes: number;
    emails: number;
  };
}

interface RecentEmail {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  boxAddress: string;
}

interface DailyUsage {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  resetAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch stats, emails and usage
      const [statsRes, emailsRes, usageRes] = await Promise.all([
        api.get<DashboardStats>('/api/dashboard/stats').catch(() => ({
          success: true,
          data: {
            totalBoxes: 0,
            totalEmails: 0,
            emailsToday: 0,
            activeWebhooks: 0,
            percentChange: { boxes: 0, emails: 0 },
          },
        })),
        api.get<RecentEmail[]>('/api/dashboard/recent-emails').catch(() => ({
          success: true,
          data: [],
        })),
        api.get<DailyUsage>('/api/dashboard/usage').catch(() => ({
          success: true,
          data: { used: 0, limit: 500, remaining: 500, percentage: 0, resetAt: '' },
        })),
      ]);

      if (statsRes.success) {
        setStats(statsRes.data ?? null);
      }
      if (emailsRes.success) {
        setRecentEmails(emailsRes.data ?? []);
      }
      // Usage response comes directly from backend (not wrapped in {success, data})
      // Handle both wrapped and unwrapped formats
      if (usageRes) {
        const usageResponse = usageRes as unknown as { data?: DailyUsage } & DailyUsage;
        const usage = usageResponse.data || usageResponse;
        if (usage && typeof usage.used === 'number') {
          setDailyUsage(usage as DailyUsage);
        }
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Não foi possível carregar os dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const statCards = [
    {
      name: 'Caixas de Email',
      value: stats?.totalBoxes ?? 0,
      change: stats?.percentChange?.boxes ?? 0,
      icon: Inbox,
      color: 'from-[#e2498a] to-[#5636d1]',
      href: '/admin/boxes',
    },
    {
      name: 'Total de Emails',
      value: stats?.totalEmails ?? 0,
      change: stats?.percentChange?.emails ?? 0,
      icon: Mail,
      color: 'from-[#5636d1] to-[#4329a8]',
      href: '/admin/emails',
    },
    {
      name: 'Emails Hoje',
      value: stats?.emailsToday ?? 0,
      icon: TrendingUp,
      color: 'from-emerald-500 to-emerald-600',
      href: '/admin/emails',
    },
    {
      name: 'Webhooks Ativos',
      value: stats?.activeWebhooks ?? 0,
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
      href: '/admin/webhooks',
    },
  ];

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="dashboard-title">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Bem-vindo de volta, <span className="font-medium">{user?.name}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="btn-secondary btn-sm flex items-center gap-2"
            data-testid="refresh-button"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <Link
            href="/admin/boxes/new"
            className="btn-brand btn-sm flex items-center gap-2"
            data-testid="new-box-button"
          >
            <Plus className="w-4 h-4" />
            Nova Caixa
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
          role="alert"
          data-testid="dashboard-error"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const isPositive = (card.change ?? 0) >= 0;

          return (
            <Link
              key={card.name}
              href={card.href}
              className="card-brand card-hover p-6 group"
              data-testid={`stat-card-${card.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {card.change !== undefined && card.change !== 0 && (
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${
                      isPositive ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {Math.abs(card.change)}%
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">{card.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? (
                    <span className="inline-block w-16 h-8 skeleton" />
                  ) : (
                    card.value.toLocaleString('pt-BR')
                  )}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Daily Usage Card */}
      {dailyUsage && (
        <div className="card-brand p-6" data-testid="daily-usage-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Uso da API Hoje</h3>
                <p className="text-xs text-gray-500">Limite diário de requisições</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {loading ? (
                  <span className="inline-block w-16 h-8 skeleton" />
                ) : (
                  <>
                    {dailyUsage.used.toLocaleString('pt-BR')}
                    <span className="text-sm font-normal text-gray-500">
                      /{dailyUsage.limit.toLocaleString('pt-BR')}
                    </span>
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {dailyUsage.remaining.toLocaleString('pt-BR')} restantes
              </p>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="relative">
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dailyUsage.percentage >= 90
                    ? 'bg-red-500'
                    : dailyUsage.percentage >= 70
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-[#5636d1] to-[#e2498a]'
                }`}
                style={{ width: `${Math.min(dailyUsage.percentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{dailyUsage.percentage}% utilizado</span>
              <span>
                Reset às{' '}
                {dailyUsage.resetAt
                  ? new Date(dailyUsage.resetAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '00:00'}{' '}
                UTC
              </span>
            </div>
          </div>
          {dailyUsage.percentage >= 80 && (
            <div className={`mt-3 flex items-center gap-2 text-sm ${
              dailyUsage.percentage >= 90 ? 'text-red-600' : 'text-amber-600'
            }`}>
              <AlertCircle className="w-4 h-4" />
              <span>
                {dailyUsage.percentage >= 90
                  ? 'Você está próximo do limite diário!'
                  : 'Atenção: uso elevado da API hoje'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Emails */}
        <div className="lg:col-span-2 card-brand" data-testid="recent-emails-card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Emails Recentes</h2>
              <Link
                href="/admin/emails"
                className="text-sm font-medium hover:underline"
                style={{ color: 'var(--mockmail-purple)' }}
              >
                Ver todos
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex gap-4">
                  <div className="w-10 h-10 skeleton rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="w-48 h-4 skeleton" />
                    <div className="w-32 h-3 skeleton" />
                  </div>
                </div>
              ))
            ) : recentEmails.length === 0 ? (
              <div className="empty-state py-12">
                <Mail className="empty-state-icon" />
                <p className="empty-state-title">Nenhum email ainda</p>
                <p className="empty-state-description">
                  Os emails recebidos aparecerão aqui
                </p>
              </div>
            ) : (
              recentEmails.slice(0, 5).map((email) => (
                <Link
                  key={email.id}
                  href={`/admin/emails/${email.id}`}
                  className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                  data-testid={`email-item-${email.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {email.subject || '(Sem assunto)'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      De: {email.from}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge-brand-purple text-xs">
                        {email.boxAddress}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(email.receivedAt).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions & Tips */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card-brand p-6" data-testid="quick-actions-card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
            <div className="space-y-3">
              <Link
                href="/admin/boxes/new"
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Criar Caixa</p>
                  <p className="text-xs text-gray-500">Nova caixa de email temporário</p>
                </div>
              </Link>
              <Link
                href="/admin/webhooks/new"
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Configurar Webhook</p>
                  <p className="text-xs text-gray-500">Receba notificações em tempo real</p>
                </div>
              </Link>
              <Link
                href="/admin/api-keys/new"
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Gerar API Key</p>
                  <p className="text-xs text-gray-500">Para integração via API</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Integration Tip */}
          <div className="card-brand-accent p-6" data-testid="integration-tip-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              💡 Dica de Integração
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Use nossa API REST para integrar o MockMail com seus pipelines de teste.
              Suportamos polling e webhooks para notificação de novos emails.
            </p>
            <Link
              href="/docs/api"
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--mockmail-purple)' }}
            >
              Ver documentação →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
