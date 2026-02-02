'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import {
  Mail,
  RefreshCw,
  AlertCircle,
  Search,
  Inbox,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  boxAddress: string;
}

interface EmailsData {
  data: Email[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const pageRef = useRef(1);

  // Fetch inicial ou refresh - reseta a lista
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsInitialLoad(true);
    pageRef.current = 1;
    setPage(1);

    try {
      const response = await api.get<EmailsData>(`/api/mail/emails?page=1&limit=20`);
      if (response.success) {
        const apiResponse = response as unknown as { success: boolean; data: Email[]; pagination: { totalPages: number } };
        setEmails(apiResponse.data || []);
        setTotalPages(apiResponse.pagination?.totalPages || 1);
      }
    } catch {
      setError('Não foi possível carregar os emails');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, []);

  // Fetch para carregar mais itens (infinite scroll)
  const loadMoreEmails = useCallback(async () => {
    const nextPage = pageRef.current + 1;
    
    try {
      const response = await api.get<EmailsData>(`/api/mail/emails?page=${nextPage}&limit=20`);
      if (response.success) {
        const apiResponse = response as unknown as { success: boolean; data: Email[]; pagination: { totalPages: number } };
        setEmails(prev => [...prev, ...(apiResponse.data || [])]);
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
    loadMoreEmails,
    page < totalPages,
    { threshold: 200, disabled: loading || isInitialLoad }
  );

  useEffect(() => {
    fetchEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este email?')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await api.delete(`/api/mail/emails/${id}`);
      if (response.success) {
        toast.success('Email excluído com sucesso');
        fetchEmails();
      } else {
        toast.error('Erro ao excluir email');
      }
    } catch {
      toast.error('Erro ao excluir email');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredEmails = emails.filter((email) =>
    email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.from?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.boxAddress?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="emails-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="emails-title">
            Emails Recebidos
          </h1>
          <p className="text-gray-600 mt-1">
            Visualize todos os emails das suas caixas
          </p>
        </div>
        <button
          onClick={fetchEmails}
          disabled={loading}
          className="btn-secondary btn-sm flex items-center gap-2"
          data-testid="refresh-emails-button"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por assunto, remetente ou caixa..."
          className="input-brand pl-12 w-full sm:w-96"
          data-testid="search-emails-input"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
          role="alert"
          data-testid="emails-error"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Emails List */}
      <div className="card-brand" data-testid="emails-list">
        {loading ? (
          <div className="p-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border-b border-gray-100 last:border-0">
                <div className="w-10 h-10 skeleton rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="w-3/4 h-5 skeleton" />
                  <div className="w-1/2 h-4 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="empty-state py-16">
            <Inbox className="empty-state-icon" />
            <p className="empty-state-title">
              {searchTerm ? 'Nenhum email encontrado' : 'Nenhum email ainda'}
            </p>
            <p className="empty-state-description">
              {searchTerm
                ? 'Tente buscar por outro termo'
                : 'Os emails recebidos aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                data-testid={`email-item-${email.id}`}
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>

                {/* Content */}
                <Link
                  href={`/admin/emails/${email.id}`}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-gray-900 truncate hover:text-[#5636d1]">
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
                </Link>

                {/* Actions */}
                <button
                  onClick={() => handleDelete(email.id)}
                  disabled={deletingId === email.id}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Excluir email"
                  data-testid={`delete-email-${email.id}`}
                >
                  <Trash2 className={`w-4 h-4 ${deletingId === email.id ? 'animate-pulse' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Infinite Scroll Sentinel */}
      <div 
        ref={sentinelRef} 
        className="h-4" 
        data-testid="emails-sentinel"
      />
      
      {/* Loading More Indicator */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-4 gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando mais emails...</span>
        </div>
      )}
      
      {/* End of List Indicator */}
      {!loading && !isLoadingMore && page >= totalPages && emails.length > 0 && (
        <p className="text-center text-sm text-gray-400 py-4">
          Fim da lista • {emails.length} email{emails.length !== 1 ? 's' : ''} carregado{emails.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
