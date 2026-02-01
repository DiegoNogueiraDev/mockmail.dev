'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import {
  Key,
  ArrowLeft,
  AlertCircle,
  Copy,
  Check,
  Info,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Permission {
  value: string;
  label: string;
  description: string;
}

export default function NewApiKeyPage() {
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['read_emails']);
  const [rateLimit, setRateLimit] = useState(1000);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Permissões disponíveis definidas localmente (constante, não precisa de API)
  const availablePermissions: Permission[] = [
    { value: 'read_emails', label: 'Ler Emails', description: 'Permite ler emails e listar caixas' },
    { value: 'write_emails', label: 'Escrever Emails', description: 'Permite deletar emails' },
    { value: 'manage_boxes', label: 'Gerenciar Caixas', description: 'Permite criar, editar e deletar caixas' },
    { value: 'webhooks', label: 'Webhooks', description: 'Permite gerenciar webhooks' },
  ];

  const handlePermissionToggle = (permValue: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permValue)
        ? prev.filter((p) => p !== permValue)
        : [...prev, permValue]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    if (selectedPermissions.length === 0) {
      setError('Selecione pelo menos uma permissão');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post<{ success: boolean; data: { rawKey: string }; error?: string }>(
        '/api/api-keys',
        {
          name: name.trim(),
          permissions: selectedPermissions,
          rateLimit,
          expiresInDays: expiresInDays || undefined,
        }
      );

      if (response.success && response.data) {
        setCreatedKey(response.data.data.rawKey);
        toast.success('API key criada com sucesso!');
      } else {
        setError(response.data?.error || 'Erro ao criar API key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      toast.success('API key copiada!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  // Show key confirmation screen
  if (createdKey) {
    return (
      <div className="max-w-2xl mx-auto space-y-6" data-testid="api-key-created">
        <div className="card-brand p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            API Key Criada com Sucesso!
          </h1>
          <p className="text-gray-600 mb-6">
            Copie a chave abaixo. Por segurança, ela não será exibida novamente.
          </p>

          <div className="bg-gray-900 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <code className="text-emerald-400 text-sm break-all font-mono">
                {createdKey}
              </code>
              <button
                onClick={handleCopyKey}
                className="flex-shrink-0 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                title="Copiar API key"
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
                <h3 className="font-medium text-amber-800">Como usar</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Adicione a API key no header <code className="mx-1 px-1 bg-amber-100 rounded">Authorization</code>:
                </p>
                <pre className="mt-2 text-xs bg-amber-100 p-2 rounded overflow-x-auto">
                  Authorization: Bearer {createdKey.substring(0, 20)}...
                </pre>
              </div>
            </div>
          </div>

          <Link href="/admin/api-keys" className="btn-brand">
            Ir para API Keys
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="new-api-key-page">
      {/* Back Link */}
      <Link
        href="/admin/api-keys"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        data-testid="back-to-api-keys"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para API keys
      </Link>

      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
          <Key className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="new-api-key-title">
            Nova API Key
          </h1>
          <p className="text-gray-600">
            Crie uma chave para acesso programático à API
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card-brand p-6 space-y-6" data-testid="new-api-key-form">
        {/* Error Message */}
        {error && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
            role="alert"
            data-testid="new-api-key-error"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Name */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            Nome da API Key *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Minha API Key de produção"
            className="input-brand"
            disabled={isLoading}
            maxLength={100}
            data-testid="api-key-name-input"
          />
        </div>

        {/* Permissions */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Permissões *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availablePermissions.map((perm) => (
              <button
                key={perm.value}
                type="button"
                onClick={() => handlePermissionToggle(perm.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedPermissions.includes(perm.value)
                    ? 'border-[#5636d1] bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                data-testid={`permission-${perm.value}`}
              >
                <p className={`text-sm font-medium ${selectedPermissions.includes(perm.value) ? 'text-[#5636d1]' : 'text-gray-700'}`}>
                  {perm.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{perm.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Rate Limit */}
        <div className="space-y-2">
          <label htmlFor="rateLimit" className="text-sm font-medium text-gray-700">
            Rate Limit (requisições/hora)
          </label>
          <select
            id="rateLimit"
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
            className="input-brand"
            disabled={isLoading}
            data-testid="api-key-rate-limit-select"
          >
            <option value={100}>100 req/hora</option>
            <option value={500}>500 req/hora</option>
            <option value={1000}>1.000 req/hora (padrão)</option>
            <option value={5000}>5.000 req/hora</option>
            <option value={10000}>10.000 req/hora</option>
          </select>
        </div>

        {/* Expiration */}
        <div className="space-y-2">
          <label htmlFor="expiresInDays" className="text-sm font-medium text-gray-700">
            Expiração (opcional)
          </label>
          <select
            id="expiresInDays"
            value={expiresInDays || ''}
            onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : null)}
            className="input-brand"
            disabled={isLoading}
            data-testid="api-key-expiry-select"
          >
            <option value="">Sem expiração</option>
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={180}>180 dias</option>
            <option value={365}>1 ano</option>
          </select>
          <p className="text-xs text-gray-500">
            Deixe em branco para uma API key sem data de expiração
          </p>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
          <h3 className="text-sm font-medium text-[#5636d1] mb-2">
            Segurança
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• A API key será exibida apenas uma vez após a criação</li>
            <li>• Nunca compartilhe sua API key ou a exponha em código frontend</li>
            <li>• Você pode revogar uma API key a qualquer momento</li>
            <li>• Limite de 10 API keys por usuário</li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 justify-end">
          <Link href="/admin/api-keys" className="btn-secondary" data-testid="cancel-button">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isLoading || selectedPermissions.length === 0}
            className="btn-brand flex items-center gap-2"
            data-testid="create-api-key-button"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Criando...</span>
              </>
            ) : (
              <>
                <Key className="w-5 h-5" />
                <span>Criar API Key</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
