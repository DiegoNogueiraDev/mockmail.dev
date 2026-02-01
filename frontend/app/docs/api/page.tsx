'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Book,
  Key,
  Mail,
  Inbox,
  Webhook,
  Shield,
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Componente para bloco de código
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded bg-gray-700 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copiar código"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4 text-gray-300" />
        )}
      </button>
    </div>
  );
}

// Componente para seção expansível
function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <Icon className="w-5 h-5 text-[#5636d1]" />
        <span className="font-semibold text-gray-900 flex-1">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="p-6 space-y-4">{children}</div>}
    </div>
  );
}

// Componente para endpoint
function Endpoint({
  method,
  path,
  description,
  auth,
  body,
  response,
  example,
}: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  auth: 'JWT' | 'API Key' | 'Nenhuma';
  body?: string;
  response?: string;
  example?: string;
}) {
  const methodColors = {
    GET: 'bg-emerald-100 text-emerald-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-amber-100 text-amber-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <div className="border border-gray-100 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded text-xs font-bold ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono text-gray-700">{path}</code>
        <span className="text-xs text-gray-400 ml-auto">Auth: {auth}</span>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
      {body && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Body:</p>
          <CodeBlock code={body} language="json" />
        </div>
      )}
      {response && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Resposta:</p>
          <CodeBlock code={response} language="json" />
        </div>
      )}
      {example && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Exemplo:</p>
          <CodeBlock code={example} language="bash" />
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center">
                <Book className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Documentação da API</h1>
                <p className="text-sm text-gray-500">MockMail.dev REST API</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Introdução */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Introdução</h2>
          <p className="text-gray-600 mb-4">
            A API do MockMail permite criar caixas de email temporário, receber emails e
            integrar com seus sistemas de teste automatizado. Suportamos duas formas de
            autenticação:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-purple-900">API Keys (Recomendado)</span>
              </div>
              <p className="text-sm text-purple-700">
                Para integrações servidor-servidor. Crie no dashboard e use no header
                <code className="bg-purple-100 px-1 rounded mx-1">X-API-Key</code>
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">JWT Token (Legado)</span>
              </div>
              <p className="text-sm text-blue-700">
                Para aplicações web. Faça login e use o token no header
                <code className="bg-blue-100 px-1 rounded mx-1">Authorization: Bearer</code>
              </p>
            </div>
          </div>
        </div>

        {/* Rate Limits */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">Limites de Uso</h3>
              <p className="text-sm text-amber-700">
                <strong>500 requisições por dia</strong> por usuário. O contador é resetado à
                meia-noite UTC. Você pode verificar seu uso atual no dashboard ou nos headers
                de resposta:
              </p>
              <ul className="text-sm text-amber-700 mt-2 space-y-1">
                <li>
                  <code className="bg-amber-100 px-1 rounded">X-RateLimit-Limit</code> — Limite
                  total
                </li>
                <li>
                  <code className="bg-amber-100 px-1 rounded">X-RateLimit-Remaining</code> —
                  Restantes
                </li>
                <li>
                  <code className="bg-amber-100 px-1 rounded">X-RateLimit-Reset</code> — Timestamp
                  do reset
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Base URL */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Base URL</h2>
          <CodeBlock code="https://api.mockmail.dev/api" />
          <p className="text-sm text-gray-500 mt-2">
            Para desenvolvimento local: <code>http://localhost:3000/api</code>
          </p>
        </div>

        {/* Seções de Endpoints */}
        <div className="space-y-4">
          {/* Quick Start */}
          <Section title="Quick Start - Exemplo Completo" icon={Zap} defaultOpen={true}>
            <p className="text-gray-600 mb-4">
              Exemplo completo de como criar uma caixa de email e aguardar um email:
            </p>
            <CodeBlock
              language="bash"
              code={`# 1. Criar uma caixa de email
curl -X POST https://api.mockmail.dev/api/boxes \\
  -H "X-API-Key: sua_api_key_aqui" \\
  -H "Content-Type: application/json"

# Resposta: { "id": "abc123", "address": "random123", "domain": "mockmail.dev" }

# 2. Enviar um email para random123@mockmail.dev (simule em seu sistema)

# 3. Buscar o email mais recente
curl https://api.mockmail.dev/api/mail/latest/random123@mockmail.dev \\
  -H "X-API-Key: sua_api_key_aqui"

# 4. Ou buscar por assunto específico
curl "https://api.mockmail.dev/api/mail/latest/random123@mockmail.dev/subject/Código%20de%20verificação" \\
  -H "X-API-Key: sua_api_key_aqui"`}
            />
          </Section>

          {/* Autenticação */}
          <Section title="Autenticação" icon={Shield}>
            <h4 className="font-semibold text-gray-800 mb-2">Usando API Key (Recomendado)</h4>
            <p className="text-sm text-gray-600 mb-3">
              Crie uma API Key no dashboard e adicione ao header de todas as requisições:
            </p>
            <CodeBlock code={`curl -H "X-API-Key: mk_live_abc123..." https://api.mockmail.dev/api/boxes`} />

            <h4 className="font-semibold text-gray-800 mb-2 mt-6">Usando JWT Token (Legado)</h4>
            <p className="text-sm text-gray-600 mb-3">
              Faça login para obter um token JWT e use no header Authorization:
            </p>

            <Endpoint
              method="POST"
              path="/auth/login"
              description="Autentica um usuário e retorna tokens JWT"
              auth="Nenhuma"
              body={`{
  "email": "seu@email.com",
  "password": "sua_senha"
}`}
              response={`{
  "success": true,
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "expiresIn": 900,
  "user": {
    "id": "abc123",
    "email": "seu@email.com",
    "name": "Seu Nome"
  }
}`}
            />

            <Endpoint
              method="POST"
              path="/auth/register"
              description="Cria uma nova conta de usuário"
              auth="Nenhuma"
              body={`{
  "email": "novo@email.com",
  "password": "SenhaForte@123456",
  "name": "Seu Nome"
}`}
              response={`{
  "success": true,
  "message": "Usuário criado com sucesso"
}`}
            />

            <Endpoint
              method="POST"
              path="/auth/refresh"
              description="Renova o access token usando o refresh token"
              auth="Nenhuma"
              body={`{
  "refreshToken": "eyJhbG..."
}`}
              response={`{
  "accessToken": "eyJhbG...",
  "expiresIn": 900
}`}
            />

            <Endpoint
              method="GET"
              path="/auth/me"
              description="Retorna os dados do usuário autenticado"
              auth="JWT"
              response={`{
  "id": "abc123",
  "email": "seu@email.com",
  "name": "Seu Nome",
  "role": "user"
}`}
            />
          </Section>

          {/* Caixas de Email */}
          <Section title="Caixas de Email (Boxes)" icon={Inbox}>
            <Endpoint
              method="GET"
              path="/boxes"
              description="Lista todas as caixas de email do usuário"
              auth="API Key"
              response={`{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "address": "teste",
      "domain": "mockmail.dev",
      "emailCount": 5,
      "createdAt": "2026-01-31T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}`}
              example={`curl -H "X-API-Key: sua_key" https://api.mockmail.dev/api/boxes`}
            />

            <Endpoint
              method="POST"
              path="/boxes"
              description="Cria uma nova caixa de email (endereço gerado automaticamente ou personalizado)"
              auth="API Key"
              body={`{
  "address": "minha-caixa"  // opcional - se não enviar, gera automaticamente
}`}
              response={`{
  "success": true,
  "data": {
    "id": "abc123",
    "address": "minha-caixa",
    "domain": "mockmail.dev",
    "fullAddress": "minha-caixa@mockmail.dev"
  }
}`}
              example={`# Criar com endereço personalizado
curl -X POST https://api.mockmail.dev/api/boxes \\
  -H "X-API-Key: sua_key" \\
  -H "Content-Type: application/json" \\
  -d '{"address": "teste-cypress"}'

# Criar com endereço automático
curl -X POST https://api.mockmail.dev/api/boxes \\
  -H "X-API-Key: sua_key"`}
            />

            <Endpoint
              method="GET"
              path="/boxes/:id"
              description="Retorna detalhes de uma caixa específica"
              auth="API Key"
              response={`{
  "id": "abc123",
  "address": "teste",
  "domain": "mockmail.dev",
  "emailCount": 5,
  "createdAt": "2026-01-31T10:00:00Z",
  "updatedAt": "2026-01-31T15:30:00Z"
}`}
            />

            <Endpoint
              method="GET"
              path="/boxes/:id/emails"
              description="Lista todos os emails de uma caixa"
              auth="API Key"
              response={`{
  "success": true,
  "data": [
    {
      "id": "email123",
      "from": "noreply@sistema.com",
      "subject": "Código de verificação",
      "receivedAt": "2026-01-31T15:30:00Z"
    }
  ]
}`}
            />

            <Endpoint
              method="POST"
              path="/boxes/:id/clear"
              description="Remove todos os emails de uma caixa (mantém a caixa)"
              auth="API Key"
              response={`{
  "success": true,
  "message": "5 emails removidos"
}`}
            />

            <Endpoint
              method="DELETE"
              path="/boxes/:id"
              description="Exclui uma caixa e todos os seus emails permanentemente"
              auth="API Key"
              response={`{
  "success": true,
  "message": "Caixa excluída com sucesso"
}`}
            />
          </Section>

          {/* Emails */}
          <Section title="Emails" icon={Mail}>
            <Endpoint
              method="GET"
              path="/mail/latest/:address"
              description="Retorna o email mais recente de um endereço. Ideal para testes automatizados."
              auth="API Key"
              response={`{
  "id": "email123",
  "from": "noreply@sistema.com",
  "to": ["teste@mockmail.dev"],
  "subject": "Código de verificação",
  "body": "Seu código é: 123456",
  "html": "<p>Seu código é: <strong>123456</strong></p>",
  "receivedAt": "2026-01-31T15:30:00Z",
  "attachments": []
}`}
              example={`curl -H "X-API-Key: sua_key" \\
  https://api.mockmail.dev/api/mail/latest/teste@mockmail.dev`}
            />

            <Endpoint
              method="GET"
              path="/mail/latest/:address/subject/:subject"
              description="Busca o email mais recente com um assunto específico. Útil quando há múltiplos emails."
              auth="API Key"
              response={`{
  "id": "email123",
  "from": "noreply@sistema.com",
  "subject": "Código de verificação",
  "body": "Seu código é: 123456"
}`}
              example={`# O assunto deve ser URL-encoded
curl -H "X-API-Key: sua_key" \\
  "https://api.mockmail.dev/api/mail/latest/teste@mockmail.dev/subject/C%C3%B3digo%20de%20verifica%C3%A7%C3%A3o"`}
            />

            <Endpoint
              method="GET"
              path="/mail/emails"
              description="Lista todos os emails do usuário (todas as caixas)"
              auth="API Key"
              response={`{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50
  }
}`}
              example={`# Com paginação
curl -H "X-API-Key: sua_key" \\
  "https://api.mockmail.dev/api/mail/emails?page=1&limit=20"`}
            />

            <Endpoint
              method="GET"
              path="/mail/emails/:id"
              description="Retorna um email específico por ID"
              auth="API Key"
              response={`{
  "id": "email123",
  "from": "noreply@sistema.com",
  "to": ["teste@mockmail.dev"],
  "subject": "Código de verificação",
  "body": "Seu código é: 123456",
  "html": "<p>Seu código é: <strong>123456</strong></p>",
  "headers": {...},
  "attachments": [
    {
      "filename": "documento.pdf",
      "contentType": "application/pdf",
      "size": 12345
    }
  ]
}`}
            />

            <Endpoint
              method="DELETE"
              path="/mail/emails/:id"
              description="Exclui um email específico"
              auth="API Key"
              response={`{
  "success": true,
  "message": "Email excluído"
}`}
            />
          </Section>

          {/* Webhooks */}
          <Section title="Webhooks" icon={Webhook}>
            <p className="text-gray-600 mb-4">
              Configure webhooks para receber notificações em tempo real quando eventos ocorrerem
              (ex: novo email recebido).
            </p>

            <Endpoint
              method="GET"
              path="/webhooks"
              description="Lista todos os webhooks configurados"
              auth="API Key"
              response={`{
  "success": true,
  "data": [
    {
      "id": "wh123",
      "name": "Notificação de emails",
      "url": "https://meu-servidor.com/webhook",
      "events": ["email_received"],
      "isActive": true,
      "createdAt": "2026-01-31T10:00:00Z"
    }
  ]
}`}
            />

            <Endpoint
              method="POST"
              path="/webhooks"
              description="Cria um novo webhook"
              auth="API Key"
              body={`{
  "name": "Webhook de testes",
  "url": "https://meu-servidor.com/webhook",
  "events": ["email_received", "email_opened"]
}`}
              response={`{
  "success": true,
  "data": {
    "id": "wh123",
    "secret": "whsec_abc123..."  // Use para verificar assinaturas
  }
}`}
            />

            <Endpoint
              method="POST"
              path="/webhooks/:id/test"
              description="Envia um evento de teste para verificar a conectividade"
              auth="API Key"
              response={`{
  "success": true,
  "statusCode": 200,
  "responseTime": 150
}`}
            />

            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <h4 className="font-semibold text-gray-800 mb-2">Verificando Assinaturas</h4>
              <p className="text-sm text-gray-600 mb-3">
                Cada webhook enviado inclui uma assinatura no header{' '}
                <code className="bg-gray-200 px-1 rounded">X-MockMail-Signature</code>. Verifique
                usando HMAC-SHA256:
              </p>
              <CodeBlock
                language="javascript"
                code={`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <h4 className="font-semibold text-gray-800 mb-2">Eventos Disponíveis</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>
                  <code className="bg-gray-200 px-1 rounded">email_received</code> — Novo email
                  recebido
                </li>
                <li>
                  <code className="bg-gray-200 px-1 rounded">email_opened</code> — Email foi aberto
                  (tracking)
                </li>
                <li>
                  <code className="bg-gray-200 px-1 rounded">box_created</code> — Nova caixa criada
                </li>
                <li>
                  <code className="bg-gray-200 px-1 rounded">box_deleted</code> — Caixa excluída
                </li>
              </ul>
            </div>
          </Section>

          {/* API Keys */}
          <Section title="API Keys" icon={Key}>
            <Endpoint
              method="GET"
              path="/api-keys"
              description="Lista todas as API Keys do usuário"
              auth="JWT"
              response={`{
  "success": true,
  "data": [
    {
      "id": "key123",
      "name": "Chave de produção",
      "prefix": "mk_live_abc...",
      "permissions": ["boxes:read", "boxes:write", "emails:read"],
      "lastUsedAt": "2026-01-31T15:30:00Z",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}`}
            />

            <Endpoint
              method="POST"
              path="/api-keys"
              description="Cria uma nova API Key. A chave completa só é retornada uma vez!"
              auth="JWT"
              body={`{
  "name": "Chave para CI/CD",
  "permissions": ["boxes:read", "boxes:write", "emails:read"],
  "expiresAt": "2027-01-01T00:00:00Z"  // opcional
}`}
              response={`{
  "success": true,
  "data": {
    "id": "key123",
    "rawKey": "mk_live_abc123xyz789..."  // SALVE! Não será mostrada novamente
  }
}`}
            />

            <Endpoint
              method="POST"
              path="/api-keys/:id/revoke"
              description="Revoga uma API Key (a chave para de funcionar imediatamente)"
              auth="JWT"
              response={`{
  "success": true,
  "message": "API Key revogada"
}`}
            />

            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <h4 className="font-semibold text-gray-800 mb-2">Permissões Disponíveis</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>
                  <code className="bg-gray-200 px-1 rounded">boxes:read</code> — Listar e ver caixas
                </li>
                <li>
                  <code className="bg-gray-200 px-1 rounded">boxes:write</code> — Criar/excluir
                  caixas
                </li>
                <li>
                  <code className="bg-gray-200 px-1 rounded">emails:read</code> — Ler emails
                </li>
                <li>
                  <code className="bg-gray-200 px-1 rounded">emails:write</code> — Excluir emails
                </li>
                <li>
                  <code className="bg-gray-200 px-1 rounded">webhooks:read</code> — Listar webhooks
                </li>
                <li>
                  <code className="bg-gray-200 px-1 rounded">webhooks:write</code> — Gerenciar
                  webhooks
                </li>
              </ul>
            </div>
          </Section>

          {/* Exemplos de Integração */}
          <Section title="Exemplos de Integração" icon={Code}>
            <h4 className="font-semibold text-gray-800 mb-3">Cypress - Teste E2E</h4>
            <CodeBlock
              language="javascript"
              code={`// cypress/support/commands.js

Cypress.Commands.add('createTestMailbox', () => {
  return cy.request({
    method: 'POST',
    url: 'https://api.mockmail.dev/api/boxes',
    headers: {
      'X-API-Key': Cypress.env('MOCKMAIL_API_KEY')
    }
  }).then(response => response.body.data);
});

Cypress.Commands.add('waitForEmail', (address, options = {}) => {
  const { timeout = 30000, interval = 2000, subject } = options;
  const startTime = Date.now();

  const checkEmail = () => {
    let url = \`https://api.mockmail.dev/api/mail/latest/\${address}\`;
    if (subject) {
      url += \`/subject/\${encodeURIComponent(subject)}\`;
    }

    return cy.request({
      method: 'GET',
      url,
      headers: { 'X-API-Key': Cypress.env('MOCKMAIL_API_KEY') },
      failOnStatusCode: false
    }).then(response => {
      if (response.status === 200) {
        return response.body;
      }
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout aguardando email');
      }
      return cy.wait(interval).then(checkEmail);
    });
  };

  return checkEmail();
});

// Uso no teste:
it('deve receber email de confirmação', () => {
  cy.createTestMailbox().then(mailbox => {
    const email = \`\${mailbox.address}@mockmail.dev\`;

    // Preenche formulário com email temporário
    cy.get('[data-cy=email-input]').type(email);
    cy.get('[data-cy=submit-btn]').click();

    // Aguarda e verifica o email
    cy.waitForEmail(email, { subject: 'Confirmação' }).then(email => {
      const code = email.body.match(/\\d{6}/)[0];
      cy.get('[data-cy=code-input]').type(code);
    });
  });
});`}
            />

            <h4 className="font-semibold text-gray-800 mb-3 mt-6">Python - pytest</h4>
            <CodeBlock
              language="python"
              code={`import requests
import time
import os

MOCKMAIL_API = "https://api.mockmail.dev/api"
API_KEY = os.environ["MOCKMAIL_API_KEY"]

headers = {"X-API-Key": API_KEY}

def create_mailbox():
    """Cria uma caixa de email temporário"""
    response = requests.post(f"{MOCKMAIL_API}/boxes", headers=headers)
    response.raise_for_status()
    data = response.json()["data"]
    return f"{data['address']}@{data['domain']}"

def wait_for_email(address, subject=None, timeout=30):
    """Aguarda um email chegar"""
    url = f"{MOCKMAIL_API}/mail/latest/{address}"
    if subject:
        url += f"/subject/{requests.utils.quote(subject)}"

    start = time.time()
    while time.time() - start < timeout:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        time.sleep(2)

    raise TimeoutError(f"Email não recebido em {timeout}s")

# Uso no teste:
def test_password_reset():
    email = create_mailbox()

    # Simula solicitação de reset
    requests.post("https://meu-app.com/reset-password", json={"email": email})

    # Aguarda email de reset
    mail = wait_for_email(email, subject="Redefinir senha")
    assert "reset" in mail["body"].lower()

    # Extrai link/código do email
    import re
    code = re.search(r"\\d{6}", mail["body"]).group()
    assert len(code) == 6`}
            />

            <h4 className="font-semibold text-gray-800 mb-3 mt-6">Node.js - Jest</h4>
            <CodeBlock
              language="javascript"
              code={`const axios = require('axios');

const mockmail = axios.create({
  baseURL: 'https://api.mockmail.dev/api',
  headers: { 'X-API-Key': process.env.MOCKMAIL_API_KEY }
});

async function createMailbox() {
  const { data } = await mockmail.post('/boxes');
  return \`\${data.data.address}@mockmail.dev\`;
}

async function waitForEmail(address, { subject, timeout = 30000 } = {}) {
  const start = Date.now();
  let url = \`/mail/latest/\${address}\`;
  if (subject) url += \`/subject/\${encodeURIComponent(subject)}\`;

  while (Date.now() - start < timeout) {
    try {
      const { data } = await mockmail.get(url);
      return data;
    } catch (e) {
      if (e.response?.status !== 404) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Timeout aguardando email');
}

// Uso no teste:
describe('Registro de usuário', () => {
  it('deve enviar email de boas-vindas', async () => {
    const email = await createMailbox();

    // Registra usuário
    await axios.post('https://meu-app.com/register', {
      email,
      password: 'Teste@123456',
      name: 'Teste'
    });

    // Verifica email de boas-vindas
    const mail = await waitForEmail(email, { subject: 'Bem-vindo' });
    expect(mail.body).toContain('Obrigado por se cadastrar');
  });
});`}
            />
          </Section>
        </div>

        {/* Suporte */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Precisa de ajuda?</h3>
              <p className="text-sm text-gray-600 mb-3">
                Se tiver dúvidas ou encontrar problemas, entre em contato:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>
                  Email:{' '}
                  <a href="mailto:suporte@mockmail.dev" className="text-[#5636d1] hover:underline">
                    suporte@mockmail.dev
                  </a>
                </li>
                <li>
                  GitHub:{' '}
                  <a
                    href="https://github.com/mockmail-dev/mockmail"
                    target="_blank"
                    rel="noopener"
                    className="text-[#5636d1] hover:underline"
                  >
                    github.com/mockmail-dev
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
