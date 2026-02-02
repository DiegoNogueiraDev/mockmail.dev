'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import {
  Key,
  Plus,
  RefreshCw,
  AlertCircle,
  Trash2,
  Copy,
  Check,
  Clock,
  Activity,
  ShieldCheck,
  ShieldX,
  MoreVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ApiKeyItem {
  _id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  stats: {
    usageCount: number;
    lastUsedAt?: string;
    isExpired: boolean;
    daysUntilExpiry?: number;
  };
}

interface ApiKeysData {
  data: ApiKeyItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const permissionLabels: Record<string, string> = {
  read_emails: 'Ler Emails',
  write_emails: 'Escrever Emails',
  manage_boxes: 'Gerenciar Caixas',
  webhooks: 'Webhooks',
};

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fetchApiKeys = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<ApiKeysData>(`/api/api-keys?page=${page}&limit=10`);
      if (response.success) {
        // A API retorna { success, data: [...], pagination: {...} } diretamente
        const apiResponse = response as unknown as { success: boolean; data: ApiKeyItem[]; pagination: { totalPages: number } };
        setApiKeys(apiResponse.data || []);
        setTotalPages(apiResponse.pagination?.totalPages || 1);
      }
    } catch {
      setError('Não foi possível carregar as API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleCopy = async (keyPrefix: string, id: string) => {
    try {
      await navigator.clipboard.writeText(keyPrefix);
      setCopiedId(id);
      toast.success('Prefixo copiado!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja revogar a API key "${name}"?`)) {
      return;
    }

    try {
      const response = await api.post(`/api/api-keys/${id}/revoke`);
      if (response.success) {
        toast.success('API key revogada');
        fetchApiKeys();
      } else {
        toast.error('Erro ao revogar API key');
      }
    } catch {
      toast.error('Erro ao revogar API key');
    }
    setMenuOpen(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a API key "${name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await api.delete(`/api/api-keys/${id}`);
      if (response.success) {
        toast.success('API key excluída');
        fetchApiKeys();
      } else {
        toast.error('Erro ao excluir API key');
      }
    } catch {
      toast.error('Erro ao excluir API key');
    } finally {
      setDeletingId(null);
      setMenuOpen(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="api-keys-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="api-keys-title">
            API Keys
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie chaves de API para acesso programático
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchApiKeys}
            disabled={loading}
            className="btn-secondary btn-sm flex items-center gap-2"
            data-testid="refresh-api-keys-button"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <Link
            href="/admin/api-keys/new"
            className="btn-brand btn-sm flex items-center gap-2"
            data-testid="new-api-key-button"
          >
            <Plus className="w-4 h-4" />
            Nova API Key
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
          role="alert"
          data-testid="api-keys-error"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* API Keys List */}
      <div className="card-brand" data-testid="api-keys-list">
        {loading ? (
          <div className="p-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border-b border-gray-100 last:border-0">
                <div className="w-12 h-12 skeleton rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-48 h-5 skeleton" />
                  <div className="w-32 h-4 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="empty-state py-16">
            <Key className="empty-state-icon" />
            <p className="empty-state-title">Nenhuma API key criada</p>
            <p className="empty-state-description">
              Crie uma API key para acessar a API programaticamente
            </p>
            <Link href="/admin/api-keys/new" className="btn-brand mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Criar API Key
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey._id}
                className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                data-testid={`api-key-item-${apiKey._id}`}
              >
                {/* Icon & Status */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
                    <Key className="w-6 h-6 text-white" />
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      apiKey.isActive && !apiKey.stats.isExpired
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {apiKey.isActive && !apiKey.stats.isExpired ? (
                      <>
                        <ShieldCheck className="w-3 h-3" />
                        Ativa
                      </>
                    ) : (
                      <>
                        <ShieldX className="w-3 h-3" />
                        {apiKey.stats.isExpired ? 'Expirada' : 'Revogada'}
                      </>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{apiKey.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600">
                      {apiKey.keyPrefix}...
                    </code>
                    <button
                      onClick={() => handleCopy(apiKey.keyPrefix, apiKey._id)}
                      className="p-1 rounded hover:bg-gray-200"
                      title="Copiar prefixo"
                    >
                      {copiedId === apiKey._id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {apiKey.permissions.slice(0, 3).map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 bg-purple-50 text-[#5636d1] text-xs rounded-full"
                      >
                        {permissionLabels[perm] || perm}
                      </span>
                    ))}
                    {apiKey.permissions.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{apiKey.permissions.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <div className="text-center">
                    <p className="font-semibold text-gray-900 flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      {apiKey.stats.usageCount}
                    </p>
                    <p className="text-xs">Uso total</p>
                  </div>
                  {apiKey.stats.daysUntilExpiry !== undefined && (
                    <div className="text-center">
                      <p className={`font-semibold ${apiKey.stats.daysUntilExpiry < 7 ? 'text-amber-600' : 'text-gray-900'}`}>
                        {apiKey.stats.daysUntilExpiry}d
                      </p>
                      <p className="text-xs">Para expirar</p>
                    </div>
                  )}
                  {apiKey.lastUsedAt && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {new Date(apiKey.lastUsedAt).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === apiKey._id ? null : apiKey._id)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                    data-testid={`api-key-menu-${apiKey._id}`}
                  >
                    <MoreVertical className="w-5 h-5 text-gray-500" />
                  </button>
                  {menuOpen === apiKey._id && (
                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10">
                      {apiKey.isActive && (
                        <button
                          onClick={() => handleRevoke(apiKey._id, apiKey.name)}
                          className="w-full px-4 py-2 text-sm text-left text-amber-600 hover:bg-amber-50"
                        >
                          Revogar
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(apiKey._id, apiKey.name)}
                        disabled={deletingId === apiKey._id}
                        className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className={`w-4 h-4 ${deletingId === apiKey._id ? 'animate-pulse' : ''}`} />
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2" data-testid="api-keys-pagination">
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
