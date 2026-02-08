'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import {
  Inbox,
  Search,
  RefreshCw,
  AlertCircle,
  Mail,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface BoxUser {
  _id: string;
  email: string;
  name: string;
}

interface BoxData {
  _id: string;
  address: string;
  user: BoxUser;
  emailCount: number;
  expired: boolean;
  expiresAt?: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type StatusFilter = 'all' | 'active' | 'expired';

export default function AdminBoxesPage() {
  const { hasPermission } = useAuth();
  const [boxes, setBoxes] = useState<BoxData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchBoxes = useCallback(async (page: number = 1, status: StatusFilter = 'all') => {
    try {
      const statusParam = status !== 'all' ? `&status=${status}` : '';
      const response = await api.get<BoxData[]>(`/api/admin/boxes?page=${page}&limit=20${statusParam}`);
      const apiResponse = response as unknown as {
        success: boolean;
        data: BoxData[];
        pagination: Pagination;
      };

      if (apiResponse.success) {
        setBoxes(apiResponse.data || []);
        setPagination(apiResponse.pagination);
        setError(null);
      } else {
        setError('Erro ao carregar caixas');
      }
    } catch (err) {
      console.error('Error fetching boxes:', err);
      setError('Erro ao carregar caixas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasPermission('admin_users')) {
      fetchBoxes(1, statusFilter);
    }
  }, [hasPermission, fetchBoxes, statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBoxes(pagination.page, statusFilter);
  };

  const handlePageChange = (newPage: number) => {
    setLoading(true);
    fetchBoxes(newPage, statusFilter);
  };

  const handleStatusFilterChange = (status: StatusFilter) => {
    setStatusFilter(status);
    setLoading(true);
  };

  const filteredBoxes = boxes.filter(
    (box) =>
      box.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      box.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      box.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  if (loading && !refreshing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="w-48 h-8 skeleton" />
          <div className="w-32 h-10 skeleton" />
        </div>
        <div className="card-brand">
          <div className="p-4 border-b border-gray-200 flex gap-4">
            <div className="flex-1 w-64 h-10 skeleton" />
            <div className="w-40 h-10 skeleton" />
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 skeleton rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-64 h-5 skeleton" />
                  <div className="w-32 h-4 skeleton" />
                </div>
                <div className="w-16 h-6 skeleton rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-brand p-8">
        <div className="empty-state">
          <AlertCircle className="empty-state-icon text-red-500" />
          <p className="empty-state-title">Erro</p>
          <p className="empty-state-description">{error}</p>
          <button onClick={handleRefresh} className="btn-brand mt-4">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-boxes-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Todas as Caixas</h1>
          <p className="text-gray-600 mt-1">
            {pagination.total} caixa{pagination.total !== 1 ? 's' : ''} na plataforma
          </p>
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

      {/* Boxes List */}
      <div className="card-brand">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por endereço ou usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-brand pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as StatusFilter)}
              className="input-brand"
            >
              <option value="all">Todas</option>
              <option value="active">Ativas</option>
              <option value="expired">Expiradas</option>
            </select>
          </div>
        </div>

        {/* Boxes Table */}
        {filteredBoxes.length === 0 ? (
          <div className="empty-state py-16">
            <Inbox className="empty-state-icon" />
            <p className="empty-state-title">Nenhuma caixa encontrada</p>
            <p className="empty-state-description">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente filtros diferentes'
                : 'Não há caixas cadastradas'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Caixa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Proprietário
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Emails
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Expira em
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Criada em
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBoxes.map((box) => (
                  <tr key={box._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
                          <Inbox className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900 font-mono text-sm">
                          {box.address}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {box.user?.name || 'Desconhecido'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {box.user?.email || '-'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-600">
                        <Mail className="w-4 h-4" />
                        {box.emailCount}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
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
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        {box.expiresAt
                          ? new Date(box.expiresAt).toLocaleDateString('pt-BR', {
                              dateStyle: 'short',
                            })
                          : 'Nunca'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {new Date(box.createdAt).toLocaleDateString('pt-BR', {
                          dateStyle: 'short',
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Página {pagination.page} de {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn-secondary btn-sm disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="btn-secondary btn-sm disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
