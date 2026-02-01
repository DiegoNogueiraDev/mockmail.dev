'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Settings,
  Bell,
  Shield,
  Palette,
  Globe,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [webhookAlerts, setWebhookAlerts] = useState(true);

  // Display settings
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('pt-BR');

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call to save notification settings
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success('Configurações de notificação salvas!');
    } catch {
      toast.error('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-[#5636d1]" />
          Configurações
        </h1>
        <p className="text-gray-500 mt-1">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Notifications Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
              <p className="text-sm text-gray-500">Configure como você recebe alertas</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <div>
                <p className="font-medium text-gray-900">Notificações por email</p>
                <p className="text-sm text-gray-500">Receba alertas importantes por email</p>
              </div>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="w-5 h-5 text-[#5636d1] rounded focus:ring-[#5636d1]"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <div>
                <p className="font-medium text-gray-900">Alertas de webhook</p>
                <p className="text-sm text-gray-500">Notificações quando webhooks falham</p>
              </div>
              <input
                type="checkbox"
                checked={webhookAlerts}
                onChange={(e) => setWebhookAlerts(e.target.checked)}
                className="w-5 h-5 text-[#5636d1] rounded focus:ring-[#5636d1]"
              />
            </label>
          </div>

          <button
            onClick={handleSaveNotifications}
            disabled={loading}
            className="mt-6 px-4 py-2 bg-[#5636d1] text-white rounded-xl hover:bg-[#4527a0] transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar Notificações'}
          </button>
        </div>

        {/* Display Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Palette className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Aparência</h2>
              <p className="text-sm text-gray-500">Personalize a interface</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <label className="block font-medium text-gray-900 mb-2">Tema</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#5636d1] focus:border-transparent"
              >
                <option value="light">Claro</option>
                <option value="dark" disabled>Escuro (em breve)</option>
                <option value="system" disabled>Sistema (em breve)</option>
              </select>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <label className="block font-medium text-gray-900 mb-2">Idioma</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#5636d1] focus:border-transparent"
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en" disabled>English (em breve)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Segurança</h2>
              <p className="text-sm text-gray-500">Configurações de segurança da conta</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Autenticação de dois fatores</p>
                <p className="text-sm text-gray-500">
                  Adicione uma camada extra de segurança à sua conta.
                  <br />
                  <span className="text-amber-600">Funcionalidade em desenvolvimento.</span>
                </p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="font-medium text-gray-900">Sessões ativas</p>
              <p className="text-sm text-gray-500 mb-3">
                Você está logado em 1 dispositivo
              </p>
              <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                Encerrar todas as outras sessões
              </button>
            </div>
          </div>
        </div>

        {/* API Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Globe className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">API & Integrações</h2>
              <p className="text-sm text-gray-500">Configurações para desenvolvedores</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="font-medium text-gray-900">Limite de requisições</p>
            <p className="text-sm text-gray-500 mb-2">
              Seu plano atual permite até 500 requisições por dia
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-[#e2498a] to-[#5636d1] h-2 rounded-full"
                style={{ width: '12%' }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">60/500 requisições usadas hoje</p>
          </div>
        </div>
      </div>
    </div>
  );
}
