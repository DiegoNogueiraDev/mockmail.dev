'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  Inbox,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Mail,
  Copy,
  Check,
  Search,
  Eraser,
  Sparkles,
} from 'lucide-react';
import { ExpirationTimer, CircularExpirationTimer } from '@/components/ExpirationTimer';
import toast from 'react-hot-toast';

interface EmailBox {
  id: string;
  address: string;
  emailCount: number;
  isCustom?: boolean;
  createdAt: string;
  expiresAt?: string;
  timeLeftSeconds?: number;
  timeLeftFormatted?: string;
  updatedAt: string;
}

interface BoxesData {
  data: EmailBox[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function BoxesPage() {
  const [boxes, setBoxes] = useState<EmailBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const pageRef = useRef(1);
  
  // Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning';
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    variant: 'danger',
    onConfirm: async () => {},
  });

  // Fetch inicial ou refresh - reseta a lista
  const fetchBoxes = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsInitialLoad(true);
    pageRef.current = 1;
    setPage(1);

    try {
      const response = await api.get<BoxesData>(`/api/boxes?page=1&limit=20`);
      if (response.success) {
        const apiResponse = response as unknown as { success: boolean; data: EmailBox[]; pagination: { totalPages: number } };
        setBoxes(apiResponse.data || []);
        setTotalPages(apiResponse.pagination?.totalPages || 1);
      }
    } catch {
      setError('Não foi possível carregar as caixas de email');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, []);

  // Fetch para carregar mais itens (infinite scroll)
  const loadMoreBoxes = useCallback(async () => {
    const nextPage = pageRef.current + 1;
    
    try {
      const response = await api.get<BoxesData>(`/api/boxes?page=${nextPage}&limit=20`);
      if (response.success) {
        const apiResponse = response as unknown as { success: boolean; data: EmailBox[]; pagination: { totalPages: number } };
        setBoxes(prev => [...prev, ...(apiResponse.data || [])]);
        setTotalPages(apiResponse.pagination?.totalPages || 1);
        pageRef.current = nextPage;
        setPage(nextPage);
      }
    } catch {
      // Silently fail on load more - user can refresh
    }
  }, []);

  // Hook de infinite scroll
  const { sentinelRef, isLoadingMore } = useInfiniteScroll(
    loadMoreBoxes,
    page < totalPages,
    { threshold: 200, disabled: loading || isInitialLoad }
  );

  useEffect(() => {
    fetchBoxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyAddress = async (address: string, id: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(id);
      toast.success('Endereço copiado!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erro ao copiar endereço');
    }
  };

  const handleDelete = (id: string, address: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir caixa de email',
      message: `Tem certeza que deseja excluir a caixa ${address}? Todos os emails serão perdidos permanentemente.`,
      confirmText: 'Sim, excluir',
      variant: 'danger',
      onConfirm: async () => {
        setDeletingId(id);
        try {
          const response = await api.delete(`/api/boxes/${id}`);
          if (response.success) {
            toast.success('Caixa excluída com sucesso');
            fetchBoxes();
          } else {
            toast.error('Erro ao excluir caixa');
          }
        } catch {
          toast.error('Erro ao excluir caixa');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleClear = (id: string, address: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Limpar emails',
      message: `Tem certeza que deseja remover todos os emails de ${address}? Esta ação não pode ser desfeita.`,
      confirmText: 'Sim, limpar',
      variant: 'warning',
      onConfirm: async () => {
        setClearingId(id);
        try {
          const response = await api.post(`/api/boxes/${id}/clear`);
          if (response.success) {
            toast.success('Emails limpos com sucesso');
            fetchBoxes();
          } else {
            toast.error('Erro ao limpar emails');
          }
        } catch {
          toast.error('Erro ao limpar emails');
        } finally {
          setClearingId(null);
        }
      },
    });
  };

  const filteredBoxes = boxes.filter((box) =>
    box.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const closeModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <>
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
      />

      <div className="space-y-6" data-testid="boxes-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="boxes-title">
            Caixas de Email
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie suas caixas de email temporário
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchBoxes}
            disabled={loading}
            className="btn-secondary btn-sm flex items-center gap-2"
            data-testid="refresh-boxes-button"
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por endereço..."
          className="input-brand pl-12 w-full sm:w-96"
          data-testid="search-boxes-input"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
          role="alert"
          data-testid="boxes-error"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Boxes List */}
      <div className="card-brand" data-testid="boxes-list">
        {loading ? (
          <div className="p-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border-b border-gray-100 last:border-0">
                <div className="w-12 h-12 skeleton rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-64 h-5 skeleton" />
                  <div className="w-32 h-4 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBoxes.length === 0 ? (
          <div className="empty-state py-16">
            <Inbox className="empty-state-icon" />
            <p className="empty-state-title">
              {searchTerm ? 'Nenhuma caixa encontrada' : 'Nenhuma caixa criada'}
            </p>
            <p className="empty-state-description">
              {searchTerm
                ? 'Tente buscar por outro termo'
                : 'Crie sua primeira caixa de email temporário'}
            </p>
            {!searchTerm && (
              <Link href="/admin/boxes/new" className="btn-brand mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Criar Caixa
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredBoxes.map((box) => (
              <div
                key={box.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                data-testid={`box-item-${box.id}`}
              >
                {/* Timer Circular */}
                <div className="flex-shrink-0">
                  {box.expiresAt ? (
                    <CircularExpirationTimer
                      expiresAt={box.expiresAt}
                      size={48}
                      strokeWidth={4}
                      onExpired={() => fetchBoxes()}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
                      <Inbox className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/boxes/${box.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-[#5636d1] truncate"
                      data-testid={`box-address-${box.id}`}
                    >
                      {box.address}
                    </Link>
                    <button
                      onClick={() => handleCopyAddress(box.address, box.id)}
                      className="p-1 rounded hover:bg-gray-200 transition-colors"
                      title="Copiar endereço"
                      data-testid={`copy-address-${box.id}`}
                    >
                      {copiedId === box.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    {box.isCustom && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        <Sparkles className="w-3 h-3" />
                        Personalizada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <Mail className="w-4 h-4" />
                      {box.emailCount} {box.emailCount === 1 ? 'email' : 'emails'}
                    </span>
                    {box.expiresAt && (
                      <ExpirationTimer
                        expiresAt={box.expiresAt}
                        size="sm"
                        showProgress={false}
                      />
                    )}
                    <span className="text-xs text-gray-400">
                      Criada em{' '}
                      {new Date(box.createdAt).toLocaleDateString('pt-BR', {
                        dateStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleClear(box.id, box.address)}
                    disabled={clearingId === box.id || box.emailCount === 0}
                    className="btn-secondary btn-sm flex items-center gap-1 disabled:opacity-50"
                    title="Limpar emails"
                    data-testid={`clear-box-${box.id}`}
                  >
                    <Eraser className={`w-4 h-4 ${clearingId === box.id ? 'animate-pulse' : ''}`} />
                    <span className="hidden sm:inline">Limpar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(box.id, box.address)}
                    disabled={deletingId === box.id}
                    className="btn-secondary btn-sm flex items-center gap-1 text-red-600 hover:bg-red-50 hover:border-red-200 disabled:opacity-50"
                    title="Excluir caixa"
                    data-testid={`delete-box-${box.id}`}
                  >
                    <Trash2 className={`w-4 h-4 ${deletingId === box.id ? 'animate-pulse' : ''}`} />
                    <span className="hidden sm:inline">Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Infinite Scroll Sentinel */}
      <div 
        ref={sentinelRef} 
        className="h-4" 
        data-testid="boxes-sentinel"
      />
      
      {/* Loading More Indicator */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-4 gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando mais caixas...</span>
        </div>
      )}
      
      {/* End of List Indicator */}
      {!loading && !isLoadingMore && page >= totalPages && boxes.length > 0 && (
        <p className="text-center text-sm text-gray-400 py-4">
          Fim da lista • {boxes.length} caixa{boxes.length !== 1 ? 's' : ''} carregada{boxes.length !== 1 ? 's' : ''}
        </p>
      )}
      </div>
    </>
  );
}
