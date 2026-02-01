'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import {
  Mail,
  ArrowLeft,
  Trash2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  User,
  Inbox,
  FileText,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EmailBody {
  rawHtml: string;
  plainText: string;
  metadata: {
    links: string[];
    images: string[];
  };
}

interface EmailDetail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: EmailBody;
  date: string;
  contentType: string;
  processedAt: string;
  boxAddress: string;
}

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const emailId = params.id as string;

  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'html' | 'text' | 'raw'>('html');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchEmail = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{ success: boolean; data: EmailDetail }>(`/api/mail/emails/${emailId}`);
      if (response.success && response.data) {
        setEmail(response.data.data);
      } else {
        setError('Email não encontrado');
      }
    } catch (err) {
      console.error('Error fetching email:', err);
      setError('Erro ao carregar email');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId]);

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este email?')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await api.delete(`/api/mail/emails/${emailId}`);
      if (response.success) {
        toast.success('Email excluído com sucesso');
        router.push('/admin/emails');
      } else {
        toast.error('Erro ao excluir email');
      }
    } catch {
      toast.error('Erro ao excluir email');
    } finally {
      setDeleting(false);
    }
  };

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="w-32 h-6 skeleton" />
        <div className="card-brand p-8">
          <div className="space-y-4">
            <div className="w-3/4 h-8 skeleton" />
            <div className="w-1/2 h-5 skeleton" />
            <div className="w-1/3 h-5 skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/emails"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para emails
        </Link>
        <div className="card-brand p-8">
          <div className="empty-state">
            <AlertCircle className="empty-state-icon text-red-500" />
            <p className="empty-state-title">Email não encontrado</p>
            <p className="empty-state-description">
              O email que você está procurando não existe ou foi excluído.
            </p>
            <Link href="/admin/emails" className="btn-brand mt-4">
              Voltar para emails
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="email-detail-page">
      {/* Back Link */}
      <Link
        href="/admin/emails"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        data-testid="back-to-emails"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para emails
      </Link>

      {/* Email Header */}
      <div className="card-brand p-6" data-testid="email-header">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center flex-shrink-0">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900" data-testid="email-subject">
              {email.subject || '(Sem assunto)'}
            </h1>

            <div className="mt-4 space-y-2">
              {/* From */}
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">De:</span>
                <span className="font-medium text-gray-900">{email.from}</span>
                <button
                  onClick={() => handleCopy(email.from, 'from')}
                  className="p-1 rounded hover:bg-gray-100"
                  title="Copiar remetente"
                >
                  {copied === 'from' ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>

              {/* To */}
              <div className="flex items-center gap-2 text-sm">
                <Inbox className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Para:</span>
                <Link
                  href={`/admin/boxes`}
                  className="font-medium text-[#5636d1] hover:underline"
                >
                  {email.to}
                </Link>
                <button
                  onClick={() => handleCopy(email.to, 'to')}
                  className="p-1 rounded hover:bg-gray-100"
                  title="Copiar destinatário"
                >
                  {copied === 'to' ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Recebido em:</span>
                <span className="text-gray-900">
                  {new Date(email.date || email.processedAt).toLocaleString('pt-BR', {
                    dateStyle: 'full',
                    timeStyle: 'medium',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-secondary flex items-center gap-2 text-red-600 hover:bg-red-50 hover:border-red-200"
            data-testid="delete-email"
          >
            <Trash2 className={`w-4 h-4 ${deleting ? 'animate-pulse' : ''}`} />
            <span>Excluir</span>
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="card-brand" data-testid="email-content">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setViewMode('html')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'html'
                ? 'border-[#5636d1] text-[#5636d1]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="view-html-tab"
          >
            <FileText className="w-4 h-4" />
            Visualização
          </button>
          <button
            onClick={() => setViewMode('text')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'text'
                ? 'border-[#5636d1] text-[#5636d1]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="view-text-tab"
          >
            <Code className="w-4 h-4" />
            Texto Puro
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'raw'
                ? 'border-[#5636d1] text-[#5636d1]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="view-raw-tab"
          >
            <Code className="w-4 h-4" />
            HTML Bruto
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {viewMode === 'html' && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: email.body.rawHtml }}
              data-testid="email-html-content"
            />
          )}
          {viewMode === 'text' && (
            <pre
              className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-xl overflow-auto"
              data-testid="email-text-content"
            >
              {email.body.plainText || '(Sem conteúdo de texto)'}
            </pre>
          )}
          {viewMode === 'raw' && (
            <div className="relative">
              <button
                onClick={() => handleCopy(email.body.rawHtml, 'raw')}
                className="absolute top-2 right-2 btn-secondary btn-sm flex items-center gap-1"
              >
                {copied === 'raw' ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copiar
                  </>
                )}
              </button>
              <pre
                className="whitespace-pre-wrap text-xs text-gray-700 font-mono bg-gray-50 p-4 rounded-xl overflow-auto max-h-96"
                data-testid="email-raw-content"
              >
                {email.body.rawHtml}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      {(email.body.metadata.links.length > 0 || email.body.metadata.images.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Links */}
          {email.body.metadata.links.length > 0 && (
            <div className="card-brand p-6" data-testid="email-links">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <LinkIcon className="w-4 h-4" />
                Links Extraídos ({email.body.metadata.links.length})
              </h3>
              <ul className="space-y-2 max-h-48 overflow-auto">
                {email.body.metadata.links.map((link, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#5636d1] hover:underline truncate flex-1"
                    >
                      {link}
                    </a>
                    <button
                      onClick={() => handleCopy(link, `link-${index}`)}
                      className="p-1 rounded hover:bg-gray-100 flex-shrink-0"
                      title="Copiar link"
                    >
                      {copied === `link-${index}` ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </button>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-gray-100 flex-shrink-0"
                      title="Abrir link"
                    >
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Images */}
          {email.body.metadata.images.length > 0 && (
            <div className="card-brand p-6" data-testid="email-images">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <ImageIcon className="w-4 h-4" />
                Imagens ({email.body.metadata.images.length})
              </h3>
              <ul className="space-y-2 max-h-48 overflow-auto">
                {email.body.metadata.images.map((image, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <a
                      href={image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#5636d1] hover:underline truncate flex-1"
                    >
                      {image}
                    </a>
                    <button
                      onClick={() => handleCopy(image, `image-${index}`)}
                      className="p-1 rounded hover:bg-gray-100 flex-shrink-0"
                      title="Copiar URL"
                    >
                      {copied === `image-${index}` ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
