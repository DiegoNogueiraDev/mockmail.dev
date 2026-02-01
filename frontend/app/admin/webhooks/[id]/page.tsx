'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import {
  Webhook,
  ArrowLeft,
  AlertCircle,
  Copy,
  Check,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  RotateCw,
  Globe,
  Key,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WebhookDelivery {
  _id: string;
  event: string;
  responseCode?: number;
  duration?: number;
  success: boolean;
  attempts: number;
  error?: string;
  createdAt: string;
}

interface WebhookDetail {
  _id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  status: 'active' | 'paused' | 'failed';
  headers?: Record<string, string>;
  retryCount: number;
  lastError?: string;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
  deliveries: WebhookDelivery[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  };
}

const statusConfig = {
  active: {
    label: 'Ativo',
    icon: CheckCircle,
    className: 'bg-emerald-100 text-emerald-700',
  },
  paused: {
    label: 'Pausado',
    icon: Pause,
    className: 'bg-yellow-100 text-yellow-700',
  },
  failed: {
    label: 'Falha',
    icon: XCircle,
    className: 'bg-red-100 text-red-700',
  },
};

const eventLabels: Record<string, string> = {
  email_received: 'Email Recebido',
  email_opened: 'Email Aberto',
  email_clicked: 'Link Clicado',
  box_created: 'Caixa Criada',
  box_deleted: 'Caixa Excluída',
  test: 'Teste',
};

export default function WebhookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const webhookId = params.id as string;

  const [webhook, setWebhook] = useState<WebhookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const fetchWebhook = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{ success: boolean; data: WebhookDetail }>(`/api/webhooks/${webhookId}`);
      if (response.success && response.data) {
        setWebhook(response.data.data);
      } else {
        setError('Webhook não encontrado');
      }
    } catch (err) {
      console.error('Error fetching webhook:', err);
      setError('Erro ao carregar webhook');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhook();
  }, [webhookId]);

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success('Copiado!');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await api.post<{ success: boolean; data: { success: boolean; responseCode?: number; duration?: number; error?: string }; message?: string }>(`/api/webhooks/${webhookId}/test`);
      if (response.data?.data?.success) {
        toast.success(`Teste bem-sucedido! (${response.data.data.duration}ms)`);
      } else {
        toast.error(response.data?.message || 'Falha no teste');
      }
      fetchWebhook();
    } catch {
      toast.error('Erro ao testar webhook');
    } finally {
      setTesting(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!confirm('Tem certeza que deseja regenerar o secret? Suas integrações existentes deixarão de funcionar.')) {
      return;
    }

    setRegenerating(true);
    try {
      const response = await api.post<{ success: boolean; data: { secret: string } }>(`/api/webhooks/${webhookId}/regenerate-secret`);
      if (response.success && response.data) {
        setWebhook((prev) => prev ? { ...prev, secret: response.data!.data.secret } : null);
        setShowSecret(true);
        toast.success('Secret regenerado! Atualize suas integrações.');
      } else {
        toast.error('Erro ao regenerar secret');
      }
    } catch {
      toast.error('Erro ao regenerar secret');
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!webhook) return;
    const newStatus = webhook.status === 'active' ? 'paused' : 'active';

    setTogglingStatus(true);
    try {
      const response = await api.put(`/api/webhooks/${webhookId}`, { status: newStatus });
      if (response.success) {
        toast.success(`Webhook ${newStatus === 'active' ? 'ativado' : 'pausado'}`);
        fetchWebhook();
      } else {
        toast.error('Erro ao alterar status');
      }
    } catch {
      toast.error('Erro ao alterar status');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este webhook? Esta ação não pode ser desfeita.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await api.delete(`/api/webhooks/${webhookId}`);
      if (response.success) {
        toast.success('Webhook excluído');
        router.push('/admin/webhooks');
      } else {
        toast.error('Erro ao excluir webhook');
      }
    } catch {
      toast.error('Erro ao excluir webhook');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="w-32 h-6 skeleton" />
        <div className="card-brand p-8">
          <div className="flex gap-4">
            <div className="w-14 h-14 skeleton rounded-2xl" />
            <div className="space-y-2 flex-1">
              <div className="w-64 h-6 skeleton" />
              <div className="w-48 h-4 skeleton" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !webhook) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/webhooks"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para webhooks
        </Link>
        <div className="card-brand p-8">
          <div className="empty-state">
            <AlertCircle className="empty-state-icon text-red-500" />
            <p className="empty-state-title">Webhook não encontrado</p>
            <p className="empty-state-description">
              O webhook que você está procurando não existe ou foi excluído.
            </p>
            <Link href="/admin/webhooks" className="btn-brand mt-4">
              Voltar para webhooks
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[webhook.status].icon;

  return (
    <div className="space-y-6" data-testid="webhook-detail-page">
      {/* Back Link */}
      <Link
        href="/admin/webhooks"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        data-testid="back-to-webhooks"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para webhooks
      </Link>

      {/* Webhook Header */}
      <div className="card-brand p-6" data-testid="webhook-header">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center flex-shrink-0">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900" data-testid="webhook-name">
                {webhook.name}
              </h1>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[webhook.status].className}`}
              >
                <StatusIcon className="w-3 h-3" />
                {statusConfig[webhook.status].label}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <Globe className="w-4 h-4" />
              <span className="truncate">{webhook.url}</span>
              <button
                onClick={() => handleCopy(webhook.url, 'url')}
                className="p-1 rounded hover:bg-gray-100"
              >
                {copied === 'url' ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleTest}
              disabled={testing || webhook.status !== 'active'}
              className="btn-secondary btn-sm flex items-center gap-2"
              data-testid="test-webhook"
            >
              <Zap className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
              Testar
            </button>
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className="btn-secondary btn-sm flex items-center gap-2"
              data-testid="toggle-webhook"
            >
              {webhook.status === 'active' ? (
                <Pause className={`w-4 h-4 ${togglingStatus ? 'animate-pulse' : ''}`} />
              ) : (
                <Play className={`w-4 h-4 ${togglingStatus ? 'animate-pulse' : ''}`} />
              )}
              {webhook.status === 'active' ? 'Pausar' : 'Ativar'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-secondary btn-sm flex items-center gap-2 text-red-600 hover:bg-red-50 hover:border-red-200"
              data-testid="delete-webhook"
            >
              <Trash2 className={`w-4 h-4 ${deleting ? 'animate-pulse' : ''}`} />
              Excluir
            </button>
          </div>
        </div>
      </div>

      {/* Stats and Secret */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stats */}
        <div className="card-brand p-6" data-testid="webhook-stats">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-900">{webhook.stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-600">{webhook.stats.successful}</p>
              <p className="text-xs text-gray-500">Sucesso</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-xl">
              <p className="text-2xl font-bold text-red-600">{webhook.stats.failed}</p>
              <p className="text-xs text-gray-500">Falhas</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-xl">
              <p className="text-2xl font-bold text-[#5636d1]">{webhook.stats.avgDuration}ms</p>
              <p className="text-xs text-gray-500">Latência Média</p>
            </div>
          </div>
        </div>

        {/* Secret */}
        <div className="card-brand p-6" data-testid="webhook-secret">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Key className="w-5 h-5" />
              Secret
            </h2>
            <button
              onClick={handleRegenerateSecret}
              disabled={regenerating}
              className="btn-secondary btn-sm flex items-center gap-2"
              data-testid="regenerate-secret"
            >
              <RotateCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerar
            </button>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <code className="text-emerald-400 text-sm break-all font-mono">
                {showSecret ? webhook.secret : '••••••••••••••••••••••••••••••••'}
              </code>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-xs text-gray-400"
                >
                  {showSecret ? 'Ocultar' : 'Mostrar'}
                </button>
                <button
                  onClick={() => handleCopy(webhook.secret, 'secret')}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  {copied === 'secret' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="card-brand p-6" data-testid="webhook-events">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Eventos Configurados</h2>
        <div className="flex flex-wrap gap-2">
          {webhook.events.map((event) => (
            <span
              key={event}
              className="px-3 py-1.5 bg-purple-50 text-[#5636d1] text-sm rounded-full font-medium"
            >
              {eventLabels[event] || event}
            </span>
          ))}
        </div>
      </div>

      {/* Last Error */}
      {webhook.lastError && (
        <div className="card-brand p-6 border-red-200 bg-red-50" data-testid="webhook-error">
          <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5" />
            Último Erro
          </h2>
          <p className="text-sm text-red-600 font-mono">{webhook.lastError}</p>
        </div>
      )}

      {/* Delivery History */}
      <div className="card-brand" data-testid="webhook-deliveries">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Histórico de Entregas</h2>
          <button
            onClick={fetchWebhook}
            className="btn-secondary btn-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
        {webhook.deliveries.length === 0 ? (
          <div className="empty-state py-12">
            <Clock className="empty-state-icon" />
            <p className="empty-state-title">Nenhuma entrega ainda</p>
            <p className="empty-state-description">
              As entregas aparecerão aqui quando eventos ocorrerem
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {webhook.deliveries.map((delivery) => (
              <div
                key={delivery._id}
                className="flex items-center gap-4 p-4"
                data-testid={`delivery-${delivery._id}`}
              >
                {/* Status Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    delivery.success ? 'bg-emerald-100' : 'bg-red-100'
                  }`}
                >
                  {delivery.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {eventLabels[delivery.event] || delivery.event}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {delivery.responseCode && (
                      <span className={delivery.success ? 'text-emerald-600' : 'text-red-600'}>
                        HTTP {delivery.responseCode}
                      </span>
                    )}
                    {delivery.duration && <span>{delivery.duration}ms</span>}
                    {delivery.attempts > 1 && (
                      <span className="text-amber-600">{delivery.attempts} tentativas</span>
                    )}
                    <span className="text-gray-400">
                      {new Date(delivery.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {delivery.error && (
                    <p className="text-xs text-red-600 mt-1 truncate">{delivery.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
