'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Eye, EyeOff, AlertCircle, ArrowRight, ArrowLeft, Zap, Shield, Code } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Validar callbackUrl: aceitar apenas paths relativos internos (previne open redirect)
  const rawCallback = searchParams.get('callbackUrl') || '/admin/dashboard';
  const callbackUrl = rawCallback.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : '/admin/dashboard';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      router.push(callbackUrl);
    } catch (err: unknown) {
      let errorMessage = 'Erro ao fazer login. Verifique suas credenciais.';

      if (err && typeof err === 'object') {
        const apiError = err as { data?: { error?: string }; message?: string };
        if (apiError.data?.error) {
          errorMessage = apiError.data.error;
        } else if (apiError.message) {
          errorMessage = apiError.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" data-testid="login-page">
      {/* Skip Link */}
      <a href="#login-form" className="skip-link">
        Pular para formulário
      </a>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #e2498a, #5636d1)' }}
              >
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gradient-brand">MockMail</span>
            </Link>
            <Link
              href="/register"
              className="btn-brand btn-sm flex items-center gap-2"
            >
              <span>Criar Conta</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main
        className="flex min-h-screen pt-16"
        role="main"
        aria-label="Página de login"
      >
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #5636d1, #e2498a)' }}
          />
          {/* Pattern overlay - gitleaks:allow */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'url("data:image/svg+xml,' +
                encodeURIComponent('<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><g fill="#ffffff" fill-opacity="1"><path d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/></g></g></svg>') +
                '")',
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 text-white">
            <div className="max-w-md">
              <h2 className="text-4xl font-bold mb-6">
                Bem-vindo de volta!
              </h2>
              <p className="text-xl text-white/80 mb-8">
                Acesse sua conta para gerenciar suas caixas de email temporário e integrações.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Zap, text: '500 emails/dia' },
                  { icon: Shield, text: 'Seus dados estão seguros' },
                  { icon: Code, text: 'API completa disponível' },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-lg">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                style={{ background: 'linear-gradient(135deg, #e2498a, #5636d1)' }}
              >
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Entrar na sua conta</h1>
            </div>

            {/* Desktop Title */}
            <div className="hidden lg:block mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Entrar</h1>
              <p className="text-gray-600">
                Não tem uma conta?{' '}
                <Link
                  href="/register"
                  className="font-semibold hover:underline"
                  style={{ color: 'var(--mockmail-purple)' }}
                >
                  Criar conta
                </Link>
              </p>
            </div>

            {/* Login Form */}
            <form
              id="login-form"
              onSubmit={handleSubmit}
              className="space-y-5"
              data-testid="login-form"
              aria-describedby={error ? 'login-error-message' : undefined}
            >
              {/* Error Message */}
              {error && (
                <div
                  id="login-error-message"
                  className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"
                  role="alert"
                  aria-live="polite"
                  data-testid="login-error"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-brand"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  data-testid="login-email-input"
                />
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Senha
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-brand pr-12"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    data-testid="login-password-input"
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
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-brand py-4 text-lg flex items-center justify-center gap-2"
                data-testid="login-submit-button"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Mobile Register Link */}
            <p className="lg:hidden text-center text-gray-600 mt-6">
              Não tem uma conta?{' '}
              <Link
                href="/register"
                className="font-semibold hover:underline"
                style={{ color: 'var(--mockmail-purple)' }}
              >
                Criar conta
              </Link>
            </p>

            {/* Back to Home */}
            <div className="mt-8 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para a página inicial</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
