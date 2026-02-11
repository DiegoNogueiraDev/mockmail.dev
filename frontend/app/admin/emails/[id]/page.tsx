'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DOMPurify from 'dompurify';
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
  Paperclip,
  Eye,
  MousePointerClick,
  Download,
  MailOpen,
  FileCode,
  MessageSquare,
  Forward,
  X,
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

interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
}

interface TrackingClick {
  url: string;
  clickedAt: string;
}

interface TrackingData {
  openedAt: string | null;
  openCount: number;
  clickCount: number;
  clicks: TrackingClick[];
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
  attachments?: EmailAttachment[];
  readAt?: string;
  tracking?: TrackingData;
  headers?: Record<string, string>;
}

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const emailId = params.id as string;

  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'html' | 'text' | 'raw' | 'headers'>('html');
  const [copied, setCopied] = useState<string | null>(null);
  const [thread, setThread] = useState<Array<{ id: string; from: string; to: string; subject: string; date: string; readAt?: string }>>([]);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTo, setForwardTo] = useState('');
  const [forwarding, setForwarding] = useState(false);

  // Sanitizar HTML do email para prevenir XSS
  const sanitizedHtml = useMemo(() => {
    if (!email?.body?.rawHtml) return '';
    return DOMPurify.sanitize(email.body.rawHtml, {
      ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li','a','b','strong','i','em','u','s','sub','sup','blockquote','pre','code','table','thead','tbody','tr','th','td','img','div','span','font','center'],
      ALLOWED_ATTR: ['href','src','alt','title','width','height','align','valign','bgcolor','color','border','cellpadding','cellspacing','class','target'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['script','iframe','object','embed','form','input','textarea','select','button'],
    });
  }, [email?.body?.rawHtml]);

  const fetchEmail = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{ success: boolean; data: EmailDetail }>(`/api/mail/emails/${emailId}`);
      if (response.success) {
        // API retorna { success, data: {...} } diretamente
        const apiResponse = response as unknown as { success: boolean; data: EmailDetail };
        setEmail(apiResponse.data);
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

  const fetchThread = async () => {
    try {
      const response = await api.get<{ success: boolean; data: typeof thread }>(`/api/mail/emails/${emailId}/thread`);
      const result = response as unknown as { success: boolean; data: typeof thread };
      if (result.success && result.data.length > 1) {
        setThread(result.data);
      } else {
        setThread([]);
      }
    } catch {
      setThread([]);
    }
  };

  useEffect(() => {
    fetchEmail();
    fetchThread();
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

  const handleToggleRead = async () => {
    try {
      const response = await api.patch(`/api/mail/emails/${emailId}/read`);
      if (response.success) {
        const result = response as unknown as { success: boolean; data: { read: boolean } };
        setEmail(prev => prev ? { ...prev, readAt: result.data.read ? new Date().toISOString() : undefined } : prev);
        toast.success(result.data.read ? 'Marcado como lido' : 'Marcado como não lido');
      }
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const handleForward = async () => {
    if (!forwardTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardTo)) {
      toast.error('Email inválido');
      return;
    }
    setForwarding(true);
    try {
      const response = await api.post(`/api/mail/emails/${emailId}/forward`, { forwardTo });
      if (response.success) {
        toast.success('Email encaminhado com sucesso');
        setShowForwardModal(false);
        setForwardTo('');
      } else {
        toast.error((response as any).message || 'Erro ao encaminhar');
      }
    } catch {
      toast.error('Erro ao encaminhar email');
    } finally {
      setForwarding(false);
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowForwardModal(true)}
              className="btn-secondary flex items-center gap-2"
              data-testid="forward-email"
            >
              <Forward className="w-4 h-4" />
              <span>Encaminhar</span>
            </button>
            <button
              onClick={handleToggleRead}
              className="btn-secondary flex items-center gap-2"
              data-testid="toggle-read"
            >
              <MailOpen className="w-4 h-4" />
              <span>{email.readAt ? 'Marcar não lido' : 'Marcar lido'}</span>
            </button>
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
      </div>

      {/* Tracking Info */}
      {email.tracking && (email.tracking.openCount > 0 || email.tracking.clickCount > 0) && (
        <div className="card-brand p-4" data-testid="email-tracking">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600">
                {email.tracking.openCount} abertura{email.tracking.openCount !== 1 ? 's' : ''}
              </span>
              {email.tracking.openedAt && (
                <span className="text-xs text-gray-400">
                  (primeira: {new Date(email.tracking.openedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-600">
                {email.tracking.clickCount} clique{email.tracking.clickCount !== 1 ? 's' : ''}
              </span>
            </div>
            {email.tracking.clicks.length > 0 && (
              <details className="w-full mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  Ver detalhes dos cliques
                </summary>
                <ul className="mt-2 space-y-1 max-h-32 overflow-auto">
                  {email.tracking.clicks.map((click, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="truncate flex-1">{click.url}</span>
                      <span className="flex-shrink-0">
                        {new Date(click.clickedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}

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
          <button
            onClick={() => setViewMode('headers')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'headers'
                ? 'border-[#5636d1] text-[#5636d1]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="view-headers-tab"
          >
            <FileCode className="w-4 h-4" />
            Headers
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {viewMode === 'html' && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
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
          {viewMode === 'headers' && (
            <div className="font-mono text-xs space-y-1 max-h-96 overflow-auto" data-testid="email-headers-content">
              {email.headers && Object.keys(email.headers).length > 0 ? (
                Object.entries(email.headers).map(([key, value]) => (
                  <div key={key} className="flex gap-2 py-1 border-b border-gray-100 last:border-0">
                    <span className="font-bold text-blue-600 min-w-48 flex-shrink-0">{key}:</span>
                    <span className="text-gray-700 break-all">{value}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">Nenhum header SMTP disponível para este email.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Attachments */}
      {email.attachments && email.attachments.length > 0 && (
        <div className="card-brand p-6" data-testid="email-attachments">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Paperclip className="w-4 h-4" />
            Anexos ({email.attachments.length})
          </h3>
          <ul className="space-y-2">
            {email.attachments.map((att, index) => (
              <li key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <Paperclip className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{att.filename}</p>
                  <p className="text-xs text-gray-500">
                    {att.contentType} &middot; {att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${(att.size / 1024).toFixed(1)} KB` : `${(att.size / 1048576).toFixed(1)} MB`}
                  </p>
                </div>
                <a
                  href={`${api.baseUrl}/api/mail/emails/${email.id}/attachments/${index}`}
                  download={att.filename}
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
                  title="Baixar anexo"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Thread Sidebar */}
      {thread.length > 1 && (
        <div className="card-brand p-4" data-testid="email-thread">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4" />
            Conversa ({thread.length})
          </h3>
          <div className="space-y-1 max-h-64 overflow-auto">
            {thread.map(t => (
              <Link
                key={t.id}
                href={`/admin/emails/${t.id}`}
                className={`block p-2 rounded-lg transition-colors ${
                  t.id === email.id
                    ? 'bg-[#5636d1]/10 border border-[#5636d1]/20'
                    : 'hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{t.from}</p>
                <p className="text-xs text-gray-500 truncate">{t.subject}</p>
                <p className="text-xs text-gray-400">
                  {new Date(t.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

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

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Forward className="w-5 h-5" />
                Encaminhar Email
              </h3>
              <button onClick={() => setShowForwardModal(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Encaminhar &ldquo;{email.subject}&rdquo; para:
            </p>
            <input
              type="email"
              value={forwardTo}
              onChange={e => setForwardTo(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#5636d1] focus:border-transparent outline-none"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleForward()}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowForwardModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleForward}
                disabled={forwarding || !forwardTo}
                className="btn-brand flex items-center gap-2"
              >
                {forwarding ? 'Enviando...' : 'Encaminhar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
