'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import {
  Webhook,
  Plus,
  RefreshCw,
  AlertCircle,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WebhookItem {
  _id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'paused' | 'failed';
  lastError?: string;
  lastTriggeredAt?: string;
  createdAt: string;
  stats: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  };
}

interface WebhooksData {
  data: WebhookItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
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
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<WebhooksData>(`/api/webhooks?page=${page}&limit=10`);
      if (response.success) {
        // A API retorna { success, data: [...], pagination: {...} } diretamente
        const apiResponse = response as unknown as { success: boolean; data: WebhookItem[]; pagination: { totalPages: number } };
        setWebhooks(apiResponse.data || []);
        setTotalPages(apiResponse.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
      setError('Não foi possível carregar os webhooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o webhook "${name}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await api.delete(`/api/webhooks/${id}`);
      if (response.success) {
        toast.success('Webhook excluído com sucesso');
        fetchWebhooks();
      } else {
        toast.error('Erro ao excluir webhook');
      }
    } catch {
      toast.error('Erro ao excluir webhook');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (webhook: WebhookItem) => {
    const newStatus = webhook.status === 'active' ? 'paused' : 'active';
    setTogglingId(webhook._id);

    try {
      const response = await api.put(`/api/webhooks/${webhook._id}`, { status: newStatus });
      if (response.success) {
        toast.success(`Webhook ${newStatus === 'active' ? 'ativado' : 'pausado'}`);
        fetchWebhooks();
      } else {
        toast.error('Erro ao alterar status');
      }
    } catch {
      toast.error('Erro ao alterar status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="webhooks-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="webhooks-title">
            Webhooks
          </h1>
          <p className="text-gray-600 mt-1">
            Receba notificações em tempo real quando eventos ocorrerem
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchWebhooks}
            disabled={loading}
            className="btn-secondary btn-sm flex items-center gap-2"
            data-testid="refresh-webhooks-button"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <Link
            href="/admin/webhooks/new"
            className="btn-brand btn-sm flex items-center gap-2"
            data-testid="new-webhook-button"
          >
            <Plus className="w-4 h-4" />
            Novo Webhook
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
          role="alert"
          data-testid="webhooks-error"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Webhooks List */}
      <div className="card-brand" data-testid="webhooks-list">
        {loading ? (
          <div className="p-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border-b border-gray-100 last:border-0">
                <div className="w-12 h-12 skeleton rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-48 h-5 skeleton" />
                  <div className="w-64 h-4 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <div className="empty-state py-16">
            <Webhook className="empty-state-icon" />
            <p className="empty-state-title">Nenhum webhook configurado</p>
            <p className="empty-state-description">
              Configure webhooks para receber notificações em tempo real
            </p>
            <Link href="/admin/webhooks/new" className="btn-brand mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Criar Webhook
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {webhooks.map((webhook) => {
              const StatusIcon = statusConfig[webhook.status].icon;
              return (
                <div
                  key={webhook._id}
                  className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                  data-testid={`webhook-item-${webhook._id}`}
                >
                  {/* Icon & Status */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[webhook.status].className}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig[webhook.status].label}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/webhooks/${webhook._id}`}
                      className="text-sm font-medium text-gray-900 hover:text-[#5636d1] block truncate"
                      data-testid={`webhook-name-${webhook._id}`}
                    >
                      {webhook.name}
                    </Link>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{webhook.url}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {webhook.events.slice(0, 3).map((event) => (
                        <span
                          key={event}
                          className="px-2 py-0.5 bg-purple-50 text-[#5636d1] text-xs rounded-full"
                        >
                          {eventLabels[event] || event}
                        </span>
                      ))}
                      {webhook.events.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{webhook.events.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{webhook.stats.total}</p>
                      <p className="text-xs">Entregas</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-emerald-600">{webhook.stats.successful}</p>
                      <p className="text-xs">Sucesso</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-red-600">{webhook.stats.failed}</p>
                      <p className="text-xs">Falhas</p>
                    </div>
                    {webhook.lastTriggeredAt && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {new Date(webhook.lastTriggeredAt).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(webhook)}
                      disabled={togglingId === webhook._id}
                      className="btn-secondary btn-sm flex items-center gap-1"
                      title={webhook.status === 'active' ? 'Pausar' : 'Ativar'}
                      data-testid={`toggle-webhook-${webhook._id}`}
                    >
                      {webhook.status === 'active' ? (
                        <Pause className={`w-4 h-4 ${togglingId === webhook._id ? 'animate-pulse' : ''}`} />
                      ) : (
                        <Play className={`w-4 h-4 ${togglingId === webhook._id ? 'animate-pulse' : ''}`} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(webhook._id, webhook.name)}
                      disabled={deletingId === webhook._id}
                      className="btn-secondary btn-sm flex items-center gap-1 text-red-600 hover:bg-red-50 hover:border-red-200"
                      title="Excluir"
                      data-testid={`delete-webhook-${webhook._id}`}
                    >
                      <Trash2 className={`w-4 h-4 ${deletingId === webhook._id ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2" data-testid="webhooks-pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary btn-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary btn-sm disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
