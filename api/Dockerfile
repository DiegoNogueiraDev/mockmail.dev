# =============================================================================
# Dockerfile - MockMail API
# =============================================================================
# Multi-stage build para otimização de tamanho e segurança
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Instalar dependências de build
RUN apk add --no-cache python3 make g++

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar dependências
RUN npm ci --only=production && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependências do stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Build da aplicação TypeScript
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Runner (Produção)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Argumentos de build
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Criar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mockmail

# Instalar apenas curl para healthcheck
RUN apk add --no-cache curl

# Copiar arquivos necessários
COPY --from=builder --chown=mockmail:nodejs /app/dist ./dist
COPY --from=builder --chown=mockmail:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mockmail:nodejs /app/package.json ./package.json

# Copiar Prisma se existir
COPY --from=builder --chown=mockmail:nodejs /app/prisma ./prisma 2>/dev/null || true

# Mudar para usuário não-root
USER mockmail

# Expor porta
EXPOSE 3000

# Variáveis de ambiente padrão
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/csrf-token || exit 1

# Comando de inicialização
CMD ["node", "dist/server.js"]
