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
import RecentEmailsCard from '@/components/dashboard/RecentEmailsCard';
import UsageChartCard from '@/components/dashboard/UsageChartCard';

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
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch stats and usage (emails are lazy-loaded separately)
      const [statsRes, usageRes] = await Promise.all([
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
        api.get<DailyUsage>('/api/dashboard/usage').catch(() => ({
          success: true,
          data: { used: 0, limit: 500, remaining: 500, percentage: 0, resetAt: '' },
        })),
      ]);

      if (statsRes.success) {
        setStats(statsRes.data ?? null);
      }
      // Usage response - handle both wrapped and unwrapped formats
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

      {/* Welcome Banner - 500 emails/day */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #5636d1, #e2498a)' }}
        role="banner"
        data-testid="welcome-banner"
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">
                🎉 500 emails e requisições diárias!
              </h2>
              <p className="text-white/80 text-sm md:text-base">
                Agora você pode aproveitar ainda mais as integrações via API e webhooks.
              </p>
            </div>
          </div>
          <Link
            href="/docs/api"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-purple-700 font-semibold rounded-xl hover:bg-white/90 transition-colors flex-shrink-0"
          >
            <span>Ver API</span>
            <ArrowUpRight className="w-4 h-4" />
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
                <h3 className="text-sm font-medium text-gray-900">Uso Diário</h3>
                <p className="text-xs text-gray-500">Requisições API + emails recebidos</p>
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

      {/* Usage Chart */}
      <UsageChartCard days={7} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Emails - Lazy Loaded */}
        <RecentEmailsCard limit={5} />

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
