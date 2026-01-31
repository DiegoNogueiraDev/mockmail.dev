'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import { Inbox, ArrowLeft, Shuffle, AtSign, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NewBoxPage() {
  const [address, setAddress] = useState('');
  const [domain] = useState('mockmail.dev');
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const payload = useCustomAddress
        ? { address: address.includes('@') ? address : `${address}@${domain}` }
        : { domain };

      const response = await api.post('/api/boxes', payload);

      if (response.success) {
        toast.success('Caixa criada com sucesso!');
        router.push('/admin/boxes');
      } else {
        setError(response.error || 'Erro ao criar caixa');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar caixa');
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomPrefix = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAddress(result);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="new-box-page">
      {/* Back Link */}
      <Link
        href="/admin/boxes"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        data-testid="back-to-boxes"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para caixas
      </Link>

      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
          <Inbox className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="new-box-title">
            Nova Caixa de Email
          </h1>
          <p className="text-gray-600">
            Crie uma nova caixa para receber emails de teste
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card-brand p-6 space-y-6" data-testid="new-box-form">
        {/* Error Message */}
        {error && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
            role="alert"
            data-testid="new-box-error"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Address Type Toggle */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Tipo de Endereço</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setUseCustomAddress(false)}
              className={`p-4 rounded-xl border-2 transition-all ${
                !useCustomAddress
                  ? 'border-[#5636d1] bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              data-testid="random-address-option"
            >
              <Shuffle className={`w-6 h-6 mx-auto mb-2 ${!useCustomAddress ? 'text-[#5636d1]' : 'text-gray-400'}`} />
              <p className={`text-sm font-medium ${!useCustomAddress ? 'text-[#5636d1]' : 'text-gray-700'}`}>
                Endereço Aleatório
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Gerar automaticamente
              </p>
            </button>
            <button
              type="button"
              onClick={() => setUseCustomAddress(true)}
              className={`p-4 rounded-xl border-2 transition-all ${
                useCustomAddress
                  ? 'border-[#5636d1] bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              data-testid="custom-address-option"
            >
              <AtSign className={`w-6 h-6 mx-auto mb-2 ${useCustomAddress ? 'text-[#5636d1]' : 'text-gray-400'}`} />
              <p className={`text-sm font-medium ${useCustomAddress ? 'text-[#5636d1]' : 'text-gray-700'}`}>
                Endereço Personalizado
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Escolher nome
              </p>
            </button>
          </div>
        </div>

        {/* Custom Address Input */}
        {useCustomAddress && (
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium text-gray-700">
              Endereço de Email
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  placeholder="meu.email"
                  className="input-brand pl-12"
                  disabled={isLoading}
                  data-testid="address-input"
                />
              </div>
              <button
                type="button"
                onClick={generateRandomPrefix}
                className="btn-secondary flex items-center gap-2"
                disabled={isLoading}
                data-testid="generate-random-button"
              >
                <Shuffle className="w-4 h-4" />
                Gerar
              </button>
            </div>
            <p className="text-xs text-gray-500">
              O endereço final será: <span className="font-mono">{address || 'nome'}@{domain}</span>
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
          <h3 className="text-sm font-medium text-[#5636d1] mb-2">
            Como funciona?
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• A caixa será criada instantaneamente</li>
            <li>• Todos os emails enviados para este endereço serão recebidos</li>
            <li>• Você pode visualizar, copiar links e limpar emails a qualquer momento</li>
            <li>• Os emails são armazenados temporariamente (30 dias por padrão)</li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 justify-end">
          <Link href="/admin/boxes" className="btn-secondary" data-testid="cancel-button">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isLoading || (useCustomAddress && !address)}
            className="btn-brand flex items-center gap-2"
            data-testid="create-box-button"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Criando...</span>
              </>
            ) : (
              <>
                <Inbox className="w-5 h-5" />
                <span>Criar Caixa</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
