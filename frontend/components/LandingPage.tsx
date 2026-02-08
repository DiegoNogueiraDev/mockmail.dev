'use client';

import Link from 'next/link';
import {
  Mail,
  Shield,
  Zap,
  Code,
  Webhook,
  ArrowRight,
  Check,
  Clock,
  Globe,
  Lock,
  BarChart3,
  ChevronRight
} from 'lucide-react';

const features = [
  {
    icon: Mail,
    title: 'Emails Temporários',
    description: 'Crie caixas de email descartáveis em segundos. Perfeito para testes de cadastro e validações.',
  },
  {
    icon: Zap,
    title: 'API Rápida',
    description: 'Integre com nossa API REST em minutos. Documentação completa e exemplos prontos.',
  },
  {
    icon: Webhook,
    title: 'Webhooks',
    description: 'Receba notificações em tempo real quando emails chegarem nas suas caixas.',
  },
  {
    icon: Shield,
    title: 'Seguro',
    description: 'Seus emails são criptografados e expiram automaticamente. Privacidade garantida.',
  },
  {
    icon: Code,
    title: 'Developer-First',
    description: 'SDKs, exemplos de código e ambiente de testes. Feito por devs, para devs.',
  },
  {
    icon: BarChart3,
    title: '500 Emails/Dia',
    description: 'Limite generoso de 500 emails e requisições diárias para todas as suas integrações.',
  },
];

const benefits = [
  'Sem cartão de crédito',
  'Setup em 2 minutos',
  '500 emails/dia grátis',
  'API documentada',
  'Suporte via GitHub',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Skip Link for Accessibility */}
      <a
        href="#main-content"
        className="skip-link"
        aria-label="Pular para conteúdo principal"
      >
        Pular para conteúdo
      </a>

      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 glass border-b border-gray-100"
        role="banner"
      >
        <nav
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          aria-label="Navegação principal"
        >
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-3 group"
              aria-label="MockMail - Página inicial"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #e2498a, #5636d1)' }}
              >
                <Mail className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <span className="text-xl font-bold text-gradient-brand">MockMail</span>
            </Link>

            {/* Navigation Links - Desktop */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="/docs/api"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Documentação
              </Link>
              <Link
                href="#features"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Recursos
              </Link>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex px-4 py-2 text-gray-700 font-medium hover:text-gray-900 transition-colors"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="btn-brand btn-sm flex items-center gap-2"
              >
                <span>Começar Grátis</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main id="main-content" role="main">
        {/* Hero Section */}
        <section
          className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden"
          aria-labelledby="hero-heading"
        >
          {/* Background decorations */}
          <div className="absolute inset-0 -z-10" aria-hidden="true">
            <div
              className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
              style={{ background: 'linear-gradient(135deg, #e2498a, #5636d1)' }}
            />
            <div
              className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-3xl opacity-10"
              style={{ background: 'linear-gradient(135deg, #5636d1, #e2498a)' }}
            />
            {/* Grid pattern - gitleaks:allow (inline SVG pattern, not a secret) */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'url("data:image/svg+xml,' +
                  encodeURIComponent('<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><g fill="#000000" fill-opacity="1"><path d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/></g></g></svg>') +
                  '")',
              }}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 mb-8">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-700">
                  500 emails/dia grátis para todos
                </span>
              </div>

              {/* Heading */}
              <h1
                id="hero-heading"
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6"
              >
                Email temporário
                <br />
                <span className="text-gradient-brand">para desenvolvedores</span>
              </h1>

              {/* Subheading */}
              <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
                Crie caixas de email descartáveis para testes de integração,
                validação de cadastros e automações. Simples, rápido e gratuito.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <Link
                  href="/register"
                  className="btn-brand w-full sm:w-auto text-lg px-8 py-4 flex items-center justify-center gap-2"
                >
                  <span>Criar Conta Grátis</span>
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </Link>
                <Link
                  href="/docs/api"
                  className="btn-secondary w-full sm:w-auto text-lg px-8 py-4 flex items-center justify-center gap-2"
                >
                  <Code className="w-5 h-5" aria-hidden="true" />
                  <span>Ver Documentação</span>
                </Link>
              </div>

              {/* Benefits List */}
              <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3" aria-label="Benefícios">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-2 text-gray-600">
                    <Check className="w-5 h-5 text-green-500" aria-hidden="true" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hero Image/Code Preview */}
            <div className="mt-16 md:mt-20 relative">
              <div
                className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none"
                aria-hidden="true"
              />
              <div className="relative mx-auto max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                <div className="bg-gray-900 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-gray-400 text-sm font-mono ml-2">api.mockmail.dev</span>
                </div>
                <div className="bg-gray-950 p-6 font-mono text-sm sm:text-base">
                  <pre className="text-gray-300 overflow-x-auto">
                    <code>{`// Criar uma caixa de email temporária
const response = await fetch('https://api.mockmail.dev/api/boxes', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prefix: 'test',
    expiresIn: '1h'
  })
});

const { email } = await response.json();
console.log('📬 Email criado:', email);
// → test-abc123@mockmail.dev`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="py-20 md:py-32 bg-gray-50"
          aria-labelledby="features-heading"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2
                id="features-heading"
                className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
              >
                Tudo que você precisa para{' '}
                <span className="text-gradient-brand">testes de email</span>
              </h2>
              <p className="text-lg text-gray-600">
                Uma plataforma completa para desenvolvedores que precisam de emails temporários
                para testes automatizados e integrações.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={index}
                    className="card-brand p-8 card-hover group"
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110"
                      style={{
                        background: 'linear-gradient(135deg, rgba(226, 73, 138, 0.1), rgba(86, 54, 209, 0.1))',
                      }}
                    >
                      <Icon
                        className="w-7 h-7"
                        style={{ color: 'var(--mockmail-purple)' }}
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section
          className="py-20 md:py-32"
          aria-labelledby="how-it-works-heading"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2
                id="how-it-works-heading"
                className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
              >
                Como funciona
              </h2>
              <p className="text-lg text-gray-600">
                Em 3 passos simples você está pronto para testar
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              {[
                {
                  step: '01',
                  title: 'Crie sua conta',
                  description: 'Registre-se gratuitamente em menos de 1 minuto. Sem cartão de crédito.',
                  icon: Lock,
                },
                {
                  step: '02',
                  title: 'Gere sua API Key',
                  description: 'Crie uma chave de API no dashboard para autenticar suas requisições.',
                  icon: Code,
                },
                {
                  step: '03',
                  title: 'Comece a testar',
                  description: 'Use a API para criar caixas temporárias e receber emails de teste.',
                  icon: Mail,
                },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="relative text-center">
                    {index < 2 && (
                      <div
                        className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-purple-200 to-pink-200"
                        aria-hidden="true"
                      />
                    )}
                    <div className="relative z-10">
                      <div
                        className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #e2498a, #5636d1)' }}
                      >
                        <Icon className="w-8 h-8 text-white" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-bold text-purple-600 mb-2 block">
                        Passo {item.step}
                      </span>
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">
                        {item.title}
                      </h3>
                      <p className="text-gray-600">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-20 md:py-32"
          aria-labelledby="cta-heading"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="relative rounded-3xl overflow-hidden px-8 py-16 md:px-16 md:py-20 text-center"
              style={{ background: 'linear-gradient(135deg, #5636d1, #e2498a)' }}
            >
              {/* Background pattern - gitleaks:allow (inline SVG pattern, not a secret) */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'url("data:image/svg+xml,' +
                    encodeURIComponent('<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><g fill="#ffffff" fill-opacity="1"><path d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/></g></g></svg>') +
                    '")',
                }}
                aria-hidden="true"
              />

              <div className="relative z-10">
                <h2
                  id="cta-heading"
                  className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6"
                >
                  Pronto para simplificar
                  <br />
                  seus testes de email?
                </h2>
                <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
                  Junte-se a centenas de desenvolvedores que já usam o MockMail
                  para automatizar seus testes.
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-700 font-semibold rounded-2xl transition-all duration-300 hover:shadow-xl hover:scale-105"
                >
                  <span>Criar Conta Grátis</span>
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="border-t border-gray-200 py-12 md:py-16"
        role="contentinfo"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <Link
                href="/"
                className="flex items-center gap-3 mb-4"
                aria-label="MockMail - Página inicial"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #e2498a, #5636d1)' }}
                >
                  <Mail className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-xl font-bold text-gradient-brand">MockMail</span>
              </Link>
              <p className="text-gray-600 max-w-sm">
                Plataforma de email temporário para desenvolvedores.
                Simplifique seus testes de integração e automações.
              </p>
            </div>

            {/* Links */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Produto</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/docs/api" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Documentação
                  </Link>
                </li>
                <li>
                  <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Recursos
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Conta</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Entrar
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Criar Conta
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} MockMail.dev — Todos os direitos reservados
            </p>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/DiegoNogueiraDev/mockmail.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-900 transition-colors"
                aria-label="GitHub do MockMail"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
