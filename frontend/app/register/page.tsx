'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, AlertCircle, User, Check, X } from 'lucide-react';
import { api } from '@/lib/apiClient';
import toast from 'react-hot-toast';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'Mínimo 12 caracteres', test: (p) => p.length >= 12 },
  { label: 'Uma letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Uma letra minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Um número', test: (p) => /[0-9]/.test(p) },
  { label: 'Um caractere especial (!@#$%^&*)', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);

  const router = useRouter();

  const allRequirementsMet = passwordRequirements.every((req) => req.test(password));
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!allRequirementsMet) {
      setError('A senha não atende a todos os requisitos');
      return;
    }

    if (!passwordsMatch) {
      setError('As senhas não coincidem');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/register', {
        name,
        email,
        password,
      });

      // Se chegou aqui sem erro, o registro foi bem-sucedido (201)
      // A API retorna o usuário diretamente ou { success: true }
      if (response && !response.error) {
        toast.success('Conta criada com sucesso! Faça login para continuar.');
        router.push('/login');
      } else {
        setError(response?.error || response?.message || 'Erro ao criar conta');
      }
    } catch (err) {
      // Erro de rede ou exceção
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.';
      // Não mostrar erro se foi redirecionado para login (sessão expirada)
      if (!errorMessage.includes('Sessão expirada')) {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      data-testid="register-page"
      role="main"
      aria-label="Página de registro"
    >
      {/* Background gradient */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: 'linear-gradient(135deg, rgba(86, 54, 209, 0.05) 0%, rgba(226, 73, 138, 0.05) 100%)',
        }}
      />

      {/* Decorative elements */}
      <div
        className="fixed top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 -z-10"
        style={{ background: 'linear-gradient(135deg, #e2498a, #5636d1)' }}
      />
      <div
        className="fixed bottom-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-20 -z-10"
        style={{ background: 'linear-gradient(135deg, #5636d1, #e2498a)' }}
      />

      {/* Register Card */}
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, #e2498a, #5636d1)',
            }}
          >
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gradient-brand" data-testid="register-title">
            Criar Conta
          </h1>
          <p className="text-gray-600 mt-2">Comece a usar o MockMail agora</p>
        </div>

        {/* Register Form */}
        <div className="card-brand p-8" data-testid="register-form-container">
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            data-testid="register-form"
            aria-describedby={error ? 'register-error-message' : undefined}
          >
            {/* Error Message */}
            {error && (
              <div
                id="register-error-message"
                className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
                role="alert"
                aria-live="polite"
                data-testid="register-error"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nome
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-brand pl-12"
                  placeholder="Seu nome"
                  required
                  minLength={3}
                  maxLength={100}
                  autoComplete="name"
                  disabled={isLoading}
                  data-testid="register-name-input"
                  aria-label="Nome"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-brand pl-12"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  data-testid="register-email-input"
                  aria-label="Email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setShowRequirements(true)}
                  className="input-brand pl-12 pr-12"
                  placeholder="••••••••••••"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  data-testid="register-password-input"
                  aria-label="Senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Requirements */}
              {showRequirements && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1.5">
                  <p className="text-xs font-medium text-gray-600 mb-2">Requisitos da senha:</p>
                  {passwordRequirements.map((req, index) => {
                    const met = req.test(password);
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-2 text-xs ${
                          met ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {met ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        <span>{req.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`input-brand pl-12 pr-12 ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                        : 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : ''
                  }`}
                  placeholder="••••••••••••"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  data-testid="register-confirm-password-input"
                  aria-label="Confirmar senha"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1.5 text-xs text-red-600">As senhas não coincidem</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !allRequirementsMet || !passwordsMatch}
              className="w-full btn-brand flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="register-submit-button"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Criando conta...</span>
                </>
              ) : (
                <span>Criar Conta</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">ou</span>
            </div>
          </div>

          {/* Login Link */}
          <p className="text-center text-gray-600">
            Já tem uma conta?{' '}
            <Link
              href="/login"
              className="font-semibold hover:underline"
              style={{ color: 'var(--mockmail-purple)' }}
              data-testid="register-login-link"
            >
              Fazer login
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          © {new Date().getFullYear()} MockMail.dev — Plataforma de email temporário para testes
        </p>
      </div>
    </div>
  );
}
