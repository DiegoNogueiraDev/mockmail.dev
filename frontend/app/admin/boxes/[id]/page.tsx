'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import {
  Inbox,
  ArrowLeft,
  Mail,
  Trash2,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  Eraser,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EmailBox {
  id: string;
  address: string;
  emailCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Email {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  read: boolean;
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

export default function BoxDetailPage() {
  const params = useParams();
  const router = useRouter();
  const boxId = params.id as string;

  const [box, setBox] = useState<EmailBox | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchBox = async () => {
    try {
      const response = await api.get<EmailBox>(`/api/boxes/${boxId}`);
      if (response.success && response.data) {
        setBox(response.data);
      } else {
        setError('Caixa não encontrada');
      }
    } catch {
      setError('Erro ao carregar caixa');
    }
  };

  const fetchEmails = async () => {
    setEmailsLoading(true);
    try {
      const response = await api.get<EmailsData>(`/api/boxes/${boxId}/emails?page=${page}&limit=20`);
      if (response.success && response.data) {
        // Garante que emails seja sempre um array, mesmo se a API retornar undefined
        setEmails(response.data.data || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch {
      // Error fetching emails - mantém estado anterior ou array vazio
      setEmails([]);
    } finally {
      setEmailsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchBox();
      await fetchEmails();
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  useEffect(() => {
    if (!loading) {
      fetchEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleCopy = async () => {
    if (!box) return;
    try {
      await navigator.clipboard.writeText(box.address);
      setCopied(true);
      toast.success('Endereço copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar endereço');
    }
  };

  const handleClear = async () => {
    if (!box) return;
    if (!confirm(`Tem certeza que deseja limpar todos os emails de ${box.address}?`)) {
      return;
    }

    setClearing(true);
    try {
      const response = await api.post(`/api/boxes/${boxId}/clear`);
      if (response.success) {
        toast.success('Emails limpos com sucesso');
        fetchBox();
        fetchEmails();
      } else {
        toast.error('Erro ao limpar emails');
      }
    } catch {
      toast.error('Erro ao limpar emails');
    } finally {
      setClearing(false);
    }
  };

  const handleDelete = async () => {
    if (!box) return;
    if (!confirm(`Tem certeza que deseja excluir a caixa ${box.address}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await api.delete(`/api/boxes/${boxId}`);
      if (response.success) {
        toast.success('Caixa excluída com sucesso');
        router.push('/admin/boxes');
      } else {
        toast.error('Erro ao excluir caixa');
      }
    } catch {
      toast.error('Erro ao excluir caixa');
    } finally {
      setDeleting(false);
    }
  };

  const handleRefresh = () => {
    fetchBox();
    fetchEmails();
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
              <div className="w-32 h-4 skeleton" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !box) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/boxes"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para caixas
        </Link>
        <div className="card-brand p-8">
          <div className="empty-state">
            <AlertCircle className="empty-state-icon text-red-500" />
            <p className="empty-state-title">Caixa não encontrada</p>
            <p className="empty-state-description">
              A caixa que você está procurando não existe ou foi excluída.
            </p>
            <Link href="/admin/boxes" className="btn-brand mt-4">
              Voltar para caixas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="box-detail-page">
      {/* Back Link */}
      <Link
        href="/admin/boxes"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        data-testid="back-to-boxes"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para caixas
      </Link>

      {/* Box Header */}
      <div className="card-brand p-6" data-testid="box-header">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center flex-shrink-0">
            <Inbox className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 truncate" data-testid="box-address">
                {box.address}
              </h1>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Copiar endereço"
                data-testid="copy-address"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {box.emailCount} {box.emailCount === 1 ? 'email' : 'emails'}
              </span>
              <span>
                Criada em{' '}
                {new Date(box.createdAt).toLocaleDateString('pt-BR', {
                  dateStyle: 'medium',
                })}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="btn-secondary btn-sm flex items-center gap-2"
              data-testid="refresh-button"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={handleClear}
              disabled={clearing || box.emailCount === 0}
              className="btn-secondary btn-sm flex items-center gap-2 disabled:opacity-50"
              data-testid="clear-button"
            >
              <Eraser className={`w-4 h-4 ${clearing ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Limpar</span>
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-secondary btn-sm flex items-center gap-2 text-red-600 hover:bg-red-50 hover:border-red-200"
              data-testid="delete-button"
            >
              <Trash2 className={`w-4 h-4 ${deleting ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Excluir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Emails List */}
      <div className="card-brand" data-testid="emails-list">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Emails Recebidos</h2>
        </div>

        {emailsLoading ? (
          <div className="p-4">
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
            <Mail className="empty-state-icon" />
            <p className="empty-state-title">Nenhum email ainda</p>
            <p className="empty-state-description">
              Os emails enviados para {box.address} aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {emails.map((email) => (
              <Link
                key={email.id}
                href={`/admin/emails/${email.id}`}
                className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                data-testid={`email-item-${email.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {email.subject || '(Sem assunto)'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    De: {email.from}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(email.receivedAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <ExternalLink className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2" data-testid="emails-pagination">
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
