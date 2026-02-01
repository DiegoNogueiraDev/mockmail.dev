'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import {
  Webhook,
  ArrowLeft,
  AlertCircle,
  Copy,
  Check,
  Info,
  Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WebhookEvent {
  value: string;
  label: string;
  description: string;
}

export default function NewWebhookPage() {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['email_received']);
  const [retryCount, setRetryCount] = useState(3);
  const [availableEvents, setAvailableEvents] = useState<WebhookEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await api.get<{ success: boolean; data: WebhookEvent[] }>('/api/webhooks/events');
        if (response.success && response.data) {
          setAvailableEvents(response.data.data);
        }
      } catch (err) {
        console.error('Error fetching events:', err);
        // Fallback events
        setAvailableEvents([
          { value: 'email_received', label: 'Email Recebido', description: 'Disparado quando um novo email chega' },
          { value: 'email_opened', label: 'Email Aberto', description: 'Disparado quando um email é visualizado' },
          { value: 'email_clicked', label: 'Link Clicado', description: 'Disparado quando um link no email é clicado' },
          { value: 'box_created', label: 'Caixa Criada', description: 'Disparado quando uma nova caixa é criada' },
          { value: 'box_deleted', label: 'Caixa Excluída', description: 'Disparado quando uma caixa é excluída' },
        ]);
      }
    };
    fetchEvents();
  }, []);

  const handleEventToggle = (eventValue: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventValue)
        ? prev.filter((e) => e !== eventValue)
        : [...prev, eventValue]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    if (!url.trim()) {
      setError('URL é obrigatória');
      return;
    }

    if (selectedEvents.length === 0) {
      setError('Selecione pelo menos um evento');
      return;
    }

    // Validate URL
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      setError('URL inválida. Deve começar com http:// ou https://');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post<{ success: boolean; data: { secret: string }; error?: string }>(
        '/api/webhooks',
        {
          name: name.trim(),
          url: url.trim(),
          events: selectedEvents,
          retryCount,
        }
      );

      if (response.success && response.data) {
        setCreatedSecret(response.data.data.secret);
        toast.success('Webhook criado com sucesso!');
      } else {
        setError(response.data?.error || 'Erro ao criar webhook');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar webhook');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (!createdSecret) return;
    try {
      await navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      toast.success('Secret copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  // Show secret confirmation screen
  if (createdSecret) {
    return (
      <div className="max-w-2xl mx-auto space-y-6" data-testid="webhook-created">
        <div className="card-brand p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Webhook Criado com Sucesso!
          </h1>
          <p className="text-gray-600 mb-6">
            Guarde o secret abaixo em um local seguro. Ele não será exibido novamente.
          </p>

          <div className="bg-gray-900 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <code className="text-emerald-400 text-sm break-all font-mono">
                {createdSecret}
              </code>
              <button
                onClick={handleCopySecret}
                className="flex-shrink-0 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                title="Copiar secret"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800">Como usar o secret</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Use este secret para validar a assinatura dos webhooks. O header
                  <code className="mx-1 px-1 bg-amber-100 rounded">X-MockMail-Signature</code>
                  contém a assinatura HMAC-SHA256 do payload.
                </p>
              </div>
            </div>
          </div>

          <Link href="/admin/webhooks" className="btn-brand">
            Ir para Webhooks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="new-webhook-page">
      {/* Back Link */}
      <Link
        href="/admin/webhooks"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        data-testid="back-to-webhooks"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para webhooks
      </Link>

      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
          <Webhook className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="new-webhook-title">
            Novo Webhook
          </h1>
          <p className="text-gray-600">
            Configure um endpoint para receber notificações
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card-brand p-6 space-y-6" data-testid="new-webhook-form">
        {/* Error Message */}
        {error && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
            role="alert"
            data-testid="new-webhook-error"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Name */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            Nome do Webhook *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meu webhook de notificações"
            className="input-brand"
            disabled={isLoading}
            maxLength={100}
            data-testid="webhook-name-input"
          />
        </div>

        {/* URL */}
        <div className="space-y-2">
          <label htmlFor="url" className="text-sm font-medium text-gray-700">
            URL do Endpoint *
          </label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.exemplo.com/webhook"
              className="input-brand pl-12"
              disabled={isLoading}
              data-testid="webhook-url-input"
            />
          </div>
          <p className="text-xs text-gray-500">
            O endpoint deve aceitar requisições POST com Content-Type: application/json
          </p>
        </div>

        {/* Events */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">
            Eventos para notificar *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableEvents.map((event) => (
              <button
                key={event.value}
                type="button"
                onClick={() => handleEventToggle(event.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedEvents.includes(event.value)
                    ? 'border-[#5636d1] bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                data-testid={`event-${event.value}`}
              >
                <p className={`text-sm font-medium ${selectedEvents.includes(event.value) ? 'text-[#5636d1]' : 'text-gray-700'}`}>
                  {event.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{event.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Retry Count */}
        <div className="space-y-2">
          <label htmlFor="retryCount" className="text-sm font-medium text-gray-700">
            Tentativas de retry
          </label>
          <select
            id="retryCount"
            value={retryCount}
            onChange={(e) => setRetryCount(Number(e.target.value))}
            className="input-brand"
            disabled={isLoading}
            data-testid="webhook-retry-select"
          >
            <option value={0}>Sem retry</option>
            <option value={1}>1 tentativa</option>
            <option value={2}>2 tentativas</option>
            <option value={3}>3 tentativas (recomendado)</option>
            <option value={5}>5 tentativas</option>
            <option value={10}>10 tentativas</option>
          </select>
          <p className="text-xs text-gray-500">
            Número de tentativas em caso de falha (com backoff exponencial)
          </p>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
          <h3 className="text-sm font-medium text-[#5636d1] mb-2">
            Como funciona?
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• O webhook será chamado via POST quando os eventos selecionados ocorrerem</li>
            <li>• Um secret será gerado para validar a autenticidade das requisições</li>
            <li>• O header <code className="px-1 bg-purple-100 rounded">X-MockMail-Signature</code> contém a assinatura HMAC</li>
            <li>• Você pode testar o webhook após criá-lo</li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 justify-end">
          <Link href="/admin/webhooks" className="btn-secondary" data-testid="cancel-button">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isLoading || selectedEvents.length === 0}
            className="btn-brand flex items-center gap-2"
            data-testid="create-webhook-button"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Criando...</span>
              </>
            ) : (
              <>
                <Webhook className="w-5 h-5" />
                <span>Criar Webhook</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
