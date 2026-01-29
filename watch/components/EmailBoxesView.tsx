'use client';

import { useState, useEffect } from 'react';
import { Users, Mail, ChevronDown, ChevronUp, Clock, User, Search } from 'lucide-react';
import { formatToBrazilianTime } from '../lib/utils/dateFormatter';

interface EmailBox {
  address: string;
  createdAt: string;
  updatedAt: string;
}

interface UserBoxes {
  email: string;
  name: string;
  userId: string;
  totalBoxes: number;
  boxes: EmailBox[];
}

interface BoxesData {
  summary: {
    totalUsers: number;
    totalBoxes: number;
    averageBoxesPerUser: number;
  };
  users: UserBoxes[];
}

export default function EmailBoxesView() {
  const [data, setData] = useState<BoxesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchBoxesData = async () => {
      try {
        const response = await fetch('/api/email-boxes');
        if (!response.ok) {
          throw new Error('Failed to fetch email boxes data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBoxesData();
    // Refresh every 15 seconds
    const interval = setInterval(fetchBoxesData, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleUserExpansion = (email: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(email)) {
      newExpanded.delete(email);
    } else {
      newExpanded.add(email);
    }
    setExpandedUsers(newExpanded);
  };

  const filteredUsers = data?.users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.boxes.some(box => box.address.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const formatDate = (dateString: string) => {
    // Usa o formatador brasileiro com timezone correto
    return formatToBrazilianTime(dateString);
  };

  const getColorForBoxCount = (count: number) => {
    if (count >= 10) return 'text-red-600 bg-red-100';
    if (count >= 5) return 'text-orange-600 bg-orange-100';
    if (count >= 2) return 'text-blue-600 bg-blue-100';
    return 'text-green-600 bg-green-100';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-red-600 text-center">
          <p>Erro ao carregar dados: {error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-gray-600 text-center">
          <p>Nenhum dado disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total de Usuários</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Caixas Temporárias</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalBoxes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Média por Usuário</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.averageBoxesPerUser}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="max-w-md">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Buscar Usuário ou Caixa
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              id="search"
              name="search"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 text-gray-900 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="Digite o nome, email do usuário ou endereço da caixa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {searchTerm && (
            <p className="mt-2 text-sm text-gray-600">
              {filteredUsers.length === 0 
                ? 'Nenhum resultado encontrado' 
                : `${filteredUsers.length} ${filteredUsers.length === 1 ? 'usuário encontrado' : 'usuários encontrados'}`
              }
            </p>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Usuários e suas Caixas Temporárias
            </h2>
            <div className="text-sm text-gray-500">
              {searchTerm ? `${filteredUsers.length} de ${data.users.length}` : `${data.users.length} usuários`}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum resultado</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Tente uma busca diferente.' : 'Nenhum usuário encontrado.'}
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.email} className="p-6">
                <div 
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -m-2 p-2 rounded-lg transition-colors"
                  onClick={() => toggleUserExpansion(user.email)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getColorForBoxCount(user.totalBoxes)}`}>
                      {user.totalBoxes}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500">
                      {user.totalBoxes === 1 ? '1 caixa' : `${user.totalBoxes} caixas`}
                    </span>
                    {expandedUsers.has(user.email) ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {expandedUsers.has(user.email) && (
                  <div className="mt-4 ml-6 space-y-3">
                    {user.boxes.map((box, index) => (
                      <div 
                        key={index} 
                        className={`bg-gray-50 rounded-lg p-4 border-l-4 transition-colors ${
                          searchTerm && box.address.toLowerCase().includes(searchTerm.toLowerCase())
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {searchTerm && box.address.toLowerCase().includes(searchTerm.toLowerCase()) ? (
                                <span className="bg-yellow-200">{box.address}</span>
                              ) : (
                                box.address
                              )}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <div className="flex items-center text-sm text-gray-500">
                                <Clock className="h-4 w-4 mr-1" />
                                Criado em {formatDate(box.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
