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
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  boxAddress: string;
  read?: boolean;
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hasAttachments, setHasAttachments] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc');
  const pageRef = useRef(1);
  const searchRef = useRef('');

  // Build query string with all filters
  const buildQs = useCallback((extraPage?: number) => {
    const params = new URLSearchParams();
    params.set('page', String(extraPage || 1));
    params.set('limit', '20');
    if (searchRef.current) params.set('search', searchRef.current);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (hasAttachments) params.set('hasAttachments', hasAttachments);
    if (sortOrder !== 'date_desc') params.set('sort', sortOrder);
    return params.toString();
  }, [dateFrom, dateTo, hasAttachments, sortOrder]);

  // Debounce do searchTerm (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch inicial ou refresh - reseta a lista
  const fetchEmails = useCallback(async (search?: string) => {
    const searchParam = search ?? searchRef.current;
    searchRef.current = searchParam;
    setLoading(true);
    setError(null);
    setIsInitialLoad(true);
    pageRef.current = 1;
    setPage(1);

    try {
      const response = await api.get<EmailsData>(`/api/mail/emails?${buildQs(1)}`);
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
  }, [buildQs]);

  // Re-fetch quando busca ou filtros mudam
  useEffect(() => {
    searchRef.current = debouncedSearch;
    fetchEmails(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, dateFrom, dateTo, hasAttachments, sortOrder]);

  // Fetch para carregar mais itens (infinite scroll)
  const loadMoreEmails = useCallback(async () => {
    const nextPage = pageRef.current + 1;

    try {
      const response = await api.get<EmailsData>(`/api/mail/emails?${buildQs(nextPage)}`);
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
  }, [buildQs]);

  // Hook de infinite scroll
  const { sentinelRef, isLoadingMore } = useInfiniteScroll(
    loadMoreEmails,
    page < totalPages,
    { threshold: 200, disabled: loading || isInitialLoad }
  );

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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map(e => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir ${selectedIds.size} email(s) selecionado(s)?`)) return;

    setBulkDeleting(true);
    try {
      const response = await api.post('/api/mail/emails/bulk-delete', {
        emailIds: Array.from(selectedIds),
      });
      if (response.success) {
        const result = response as unknown as { success: boolean; deletedCount: number };
        toast.success(`${result.deletedCount} email(s) excluído(s)`);
        setSelectedIds(new Set());
        fetchEmails();
      } else {
        toast.error('Erro ao excluir emails');
      }
    } catch {
      toast.error('Erro ao excluir emails');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    const qs = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
    window.open(`${api.baseUrl}/api/mail/emails/export?format=${format}${qs}`, '_blank');
  };

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
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="btn-secondary btn-sm flex items-center gap-2"
            data-testid="export-csv-button"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="btn-secondary btn-sm flex items-center gap-2"
            data-testid="export-json-button"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
          <button
            onClick={() => fetchEmails()}
            disabled={loading}
            className="btn-secondary btn-sm flex items-center gap-2"
            data-testid="refresh-emails-button"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary btn-sm flex items-center gap-2 ${showFilters ? 'bg-gray-100' : ''}`}
            data-testid="toggle-filters"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showFilters && (
          <div className="card-brand p-4 flex flex-wrap items-end gap-4" data-testid="filters-panel">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data início</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-brand py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data fim</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-brand py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Anexos</label>
              <select
                value={hasAttachments}
                onChange={(e) => setHasAttachments(e.target.value)}
                className="input-brand py-1.5 text-sm"
              >
                <option value="">Todos</option>
                <option value="true">Com anexos</option>
                <option value="false">Sem anexos</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ordenar</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="input-brand py-1.5 text-sm"
              >
                <option value="date_desc">Mais recentes</option>
                <option value="date_asc">Mais antigos</option>
              </select>
            </div>
            {(dateFrom || dateTo || hasAttachments || sortOrder !== 'date_desc') && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setHasAttachments(''); setSortOrder('date_desc'); }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
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

      {/* Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="card-brand p-3 flex items-center gap-4 bg-blue-50 border-blue-200" data-testid="selection-toolbar">
          <input
            type="checkbox"
            checked={selectedIds.size === emails.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-[#5636d1]"
          />
          <span className="text-sm text-gray-700">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="btn-secondary btn-sm flex items-center gap-2 text-red-600 hover:bg-red-50 hover:border-red-200"
          >
            <Trash2 className={`w-4 h-4 ${bulkDeleting ? 'animate-pulse' : ''}`} />
            Excluir selecionados
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancelar
          </button>
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
        ) : emails.length === 0 ? (
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
            {emails.map((email) => (
              <div
                key={email.id}
                className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                data-testid={`email-item-${email.id}`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(email.id)}
                  onChange={() => toggleSelect(email.id)}
                  className="w-4 h-4 mt-1 rounded border-gray-300 text-[#5636d1] flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
                {/* Icon */}
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>

                {/* Content */}
                <Link
                  href={`/admin/emails/${email.id}`}
                  className="flex-1 min-w-0"
                >
                  <p className={`text-sm truncate hover:text-[#5636d1] ${!email.read ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'}`}>
                    {!email.read && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2" />}
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
