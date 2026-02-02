'use client';

import { useState, useEffect, FormEvent } from 'react';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  User,
  Mail,
  Calendar,
  Key,
  Shield,
  AlertCircle,
  Check,
  Inbox,
  Webhook,
  KeyRound,
  LogOut,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileData {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  stats?: {
    boxCount: number;
    apiKeyCount: number;
    webhookCount: number;
    createdAt?: string;
    lastLogin?: string;
  };
}

interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  specialChars: string;
}

export default function ProfilePage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit profile state
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirements | null>(null);

  // Password validation
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<ProfileData>('/api/profile');
      if (response.success && response.data) {
        setProfile(response.data);
        setNewName(response.data.name);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Não foi possível carregar o perfil');
    } finally {
      setLoading(false);
    }
  };

  const fetchPasswordRequirements = async () => {
    try {
      const response = await api.get<PasswordRequirements>('/api/profile/password-requirements');
      if (response.success && response.data) {
        setPasswordRequirements(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch password requirements:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchPasswordRequirements();
  }, []);

  // Validate password in real-time
  useEffect(() => {
    if (!newPassword || !passwordRequirements) {
      setPasswordErrors([]);
      return;
    }

    const errors: string[] = [];
    if (newPassword.length < passwordRequirements.minLength) {
      errors.push(`Mínimo ${passwordRequirements.minLength} caracteres`);
    }
    if (passwordRequirements.requireUppercase && !/[A-Z]/.test(newPassword)) {
      errors.push('Letra maiúscula');
    }
    if (passwordRequirements.requireLowercase && !/[a-z]/.test(newPassword)) {
      errors.push('Letra minúscula');
    }
    if (passwordRequirements.requireNumber && !/[0-9]/.test(newPassword)) {
      errors.push('Número');
    }
    if (passwordRequirements.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      errors.push('Caractere especial');
    }
    setPasswordErrors(errors);
  }, [newPassword, passwordRequirements]);

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName.trim().length < 3) {
      toast.error('Nome deve ter pelo menos 3 caracteres');
      return;
    }

    setSavingName(true);
    try {
      const response = await api.put<{ success: boolean; data: ProfileData; error?: string }>('/api/profile', {
        name: newName.trim(),
      });

      if (response.success) {
        toast.success('Nome atualizado!');
        setIsEditingName(false);
        fetchProfile();
      } else {
        toast.error(response.data?.error || 'Erro ao atualizar nome');
      }
    } catch {
      toast.error('Erro ao atualizar nome');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (passwordErrors.length > 0) {
      toast.error('Senha não atende aos requisitos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Senhas não coincidem');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>('/api/profile/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (response.success) {
        toast.success('Senha alterada com sucesso!');
        setShowPasswordForm(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(response.data?.error || 'Erro ao alterar senha');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao alterar senha';
      toast.error(errorMessage);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('Tem certeza que deseja encerrar todas as sessões? Você precisará fazer login novamente.')) {
      return;
    }

    try {
      const response = await api.post('/api/auth/logout-all');
      if (response.success) {
        toast.success('Todas as sessões encerradas');
        logout();
      } else {
        toast.error('Erro ao encerrar sessões');
      }
    } catch {
      toast.error('Erro ao encerrar sessões');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="profile-page-loading">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 skeleton rounded-full" />
          <div className="space-y-2">
            <div className="w-48 h-6 skeleton" />
            <div className="w-32 h-4 skeleton" />
          </div>
        </div>
        <div className="card-brand p-6">
          <div className="space-y-4">
            <div className="w-full h-12 skeleton" />
            <div className="w-full h-12 skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div
        className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
        role="alert"
        data-testid="profile-error"
      >
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{error || 'Erro ao carregar perfil'}</span>
        <button onClick={fetchProfile} className="ml-auto btn-secondary btn-sm">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="profile-page">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center flex-shrink-0">
          <User className="w-10 h-10 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="profile-title">
            {profile.name}
          </h1>
          <p className="text-gray-600 flex items-center gap-2 mt-1">
            <Mail className="w-4 h-4" />
            {profile.email}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              profile.role === 'admin'
                ? 'bg-purple-100 text-[#5636d1]'
                : 'bg-gray-100 text-gray-700'
            }`}>
              <Shield className="w-3 h-3" />
              {profile.role === 'admin' ? 'Administrador' : 'Usuário'}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Membro desde {formatDate(profile.createdAt)}
            </span>
          </div>
        </div>
        <button
          onClick={fetchProfile}
          className="btn-secondary btn-sm flex items-center gap-2"
          data-testid="refresh-profile-button"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      {profile.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="profile-stats">
          <div className="card-brand p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile.stats.boxCount}</p>
                <p className="text-xs text-gray-500">Caixas de Email</p>
              </div>
            </div>
          </div>
          <div className="card-brand p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-[#5636d1]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile.stats.apiKeyCount}</p>
                <p className="text-xs text-gray-500">API Keys</p>
              </div>
            </div>
          </div>
          <div className="card-brand p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
                <Webhook className="w-5 h-5 text-[#e2498a]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile.stats.webhookCount}</p>
                <p className="text-xs text-gray-500">Webhooks</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Information */}
      <div className="card-brand p-6" data-testid="profile-info-section">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Informações do Perfil
        </h2>

        <div className="space-y-4">
          {/* Name Field */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-700">Nome</p>
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input-brand w-64"
                    placeholder="Seu nome"
                    maxLength={100}
                    autoFocus
                    data-testid="edit-name-input"
                  />
                  <button
                    type="submit"
                    disabled={savingName}
                    className="btn-brand btn-sm"
                    data-testid="save-name-button"
                  >
                    {savingName ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNewName(profile.name);
                    }}
                    className="btn-secondary btn-sm"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <p className="text-gray-900">{profile.name}</p>
              )}
            </div>
            {!isEditingName && (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-sm text-[#5636d1] hover:underline"
                data-testid="edit-name-button"
              >
                Editar
              </button>
            )}
          </div>

          {/* Email Field (read-only) */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="text-gray-900">{profile.email}</p>
            </div>
            <span className="text-xs text-gray-400">Não editável</span>
          </div>

          {/* Last Login */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Último acesso</p>
              <p className="text-gray-900">{formatDate(profile.lastLogin)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="card-brand p-6" data-testid="security-section">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          Segurança
        </h2>

        <div className="space-y-4">
          {/* Change Password */}
          <div className="py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Senha</p>
                <p className="text-xs text-gray-500">Altere sua senha periodicamente para maior segurança</p>
              </div>
              {!showPasswordForm && (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="btn-secondary btn-sm"
                  data-testid="change-password-button"
                >
                  Alterar senha
                </button>
              )}
            </div>

            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="mt-4 space-y-4" data-testid="password-form">
                {/* Current Password */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Senha atual</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="input-brand pr-10"
                      placeholder="Digite sua senha atual"
                      required
                      data-testid="current-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Nova senha</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-brand pr-10"
                      placeholder="Digite sua nova senha"
                      required
                      data-testid="new-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Password Requirements */}
                  {passwordRequirements && newPassword && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-600 mb-2">Requisitos da senha:</p>
                      <div className="grid grid-cols-2 gap-1">
                        <RequirementItem
                          met={newPassword.length >= passwordRequirements.minLength}
                          label={`${passwordRequirements.minLength}+ caracteres`}
                        />
                        <RequirementItem
                          met={/[A-Z]/.test(newPassword)}
                          label="Letra maiúscula"
                        />
                        <RequirementItem
                          met={/[a-z]/.test(newPassword)}
                          label="Letra minúscula"
                        />
                        <RequirementItem
                          met={/[0-9]/.test(newPassword)}
                          label="Número"
                        />
                        <RequirementItem
                          met={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)}
                          label="Caractere especial"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Confirmar nova senha</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-brand pr-10"
                      placeholder="Confirme sua nova senha"
                      required
                      data-testid="confirm-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Senhas não coincidem</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={savingPassword || passwordErrors.length > 0 || newPassword !== confirmPassword}
                    className="btn-brand flex items-center gap-2"
                    data-testid="save-password-button"
                  >
                    {savingPassword ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Alterar senha'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Logout All Sessions */}
          <div className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Sessões ativas</p>
                <p className="text-xs text-gray-500">Encerre todas as sessões em outros dispositivos</p>
              </div>
              <button
                onClick={handleLogoutAll}
                className="btn-secondary btn-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                data-testid="logout-all-button"
              >
                <LogOut className="w-4 h-4" />
                Encerrar todas
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for password requirements
function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1 text-xs ${met ? 'text-emerald-600' : 'text-gray-400'}`}>
      {met ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />}
      {label}
    </div>
  );
}
