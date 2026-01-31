# =============================================================================
# Dockerfile - MockMail Watch (Frontend Next.js)
# =============================================================================
# Multi-stage build otimizado para Next.js
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Instalar libc6-compat para Alpine
RUN apk add --no-cache libc6-compat

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar dependências
RUN npm ci && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Argumentos de build
ARG NEXT_PUBLIC_API_URL=https://api.homologacao.mockmail.dev
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Copiar dependências
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Desabilitar telemetria do Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Build da aplicação
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Runner (Produção)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Argumentos de build
ARG NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=https://api.homologacao.mockmail.dev

ENV NODE_ENV=${NODE_ENV}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Instalar curl para healthcheck
RUN apk add --no-cache curl

# Copiar arquivos públicos
COPY --from=builder /app/public ./public

# Configurar permissões para cache do Next.js
RUN mkdir .next && chown nextjs:nodejs .next

# Copiar arquivos de build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Mudar para usuário não-root
USER nextjs

# Expor porta
EXPOSE 3001

# Variáveis de ambiente
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001 || exit 1

# Comando de inicialização
CMD ["node", "server.js"]
