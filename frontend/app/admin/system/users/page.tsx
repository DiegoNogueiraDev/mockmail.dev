'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import Link from 'next/link';
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  Mail,
  Inbox,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface UserData {
  _id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'system';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  boxCount: number;
  emailCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async (page: number = 1, search: string = '') => {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const response = await api.get<UserData[]>(`/api/admin/users?${params.toString()}`);
      const apiResponse = response as unknown as {
        success: boolean;
        data: UserData[];
        pagination: Pagination;
      };

      if (apiResponse.success) {
        setUsers(apiResponse.data || []);
        setPagination(apiResponse.pagination);
        setError(null);
      } else {
        setError('Erro ao carregar usuários');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Erro ao carregar usuários');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasPermission('admin_users')) {
      fetchUsers(1, '');
    }
  }, [hasPermission, fetchUsers]);

  // Debounced search effect
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (hasPermission('admin_users')) {
        setLoading(true);
        fetchUsers(1, searchTerm);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, hasPermission, fetchUsers]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers(pagination.page, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    setLoading(true);
    fetchUsers(newPage, searchTerm);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'system':
        return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'admin':
        return <ShieldCheck className="w-4 h-4 text-purple-500" />;
      default:
        return <Shield className="w-4 h-4 text-gray-400" />;
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
          <div className="p-4 border-b border-gray-200">
            <div className="w-64 h-10 skeleton" />
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 skeleton rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="w-48 h-5 skeleton" />
                  <div className="w-32 h-4 skeleton" />
                </div>
                <div className="w-20 h-6 skeleton rounded-full" />
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
    <div className="space-y-6" data-testid="admin-users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciar Usuários</h1>
          <p className="text-gray-600 mt-1">
            {pagination.total} usuário{pagination.total !== 1 ? 's' : ''} cadastrado{pagination.total !== 1 ? 's' : ''}
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

      {/* Users List */}
      <div className="card-brand">
        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-brand pl-10"
            />
          </div>
        </div>

        {/* Users Table */}
        {users.length === 0 ? (
          <div className="empty-state py-16">
            <Users className="empty-state-icon" />
            <p className="empty-state-title">Nenhum usuário encontrado</p>
            <p className="empty-state-description">
              {searchTerm
                ? 'Tente uma busca diferente'
                : 'Não há usuários cadastrados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Caixas
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Emails
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Último Login
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cadastro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr
                    key={user._id}
                    className="hover:bg-gray-50 cursor-pointer group"
                    onClick={() => window.location.href = `/admin/system/users/${user._id}`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center text-white font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-600">
                        <Inbox className="w-4 h-4" />
                        {user.boxCount}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-600">
                        <Mail className="w-4 h-4" />
                        {user.emailCount}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString('pt-BR', {
                              dateStyle: 'short',
                            })
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString('pt-BR', {
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
