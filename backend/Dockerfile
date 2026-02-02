# =============================================================================
# Dockerfile - MockMail API
# =============================================================================
# Multi-stage build para otimização de tamanho e segurança
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder (com todas as dependências para compilação)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências de build nativas
RUN apk add --no-cache python3 make g++

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar TODAS as dependências (incluindo devDependencies para build)
RUN npm ci && npm cache clean --force

# Copiar código fonte
COPY . .

# Gerar Prisma Client se existir schema
RUN if [ -f "prisma/schema.prisma" ]; then npx prisma generate; fi

# Build da aplicação TypeScript
RUN npm run build

# Garantir que diretórios opcionais existam (mesmo vazios) para o COPY funcionar
RUN mkdir -p prisma src/generated

# -----------------------------------------------------------------------------
# Stage 2: Production Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Instalar dependências de build nativas (necessárias para bcrypt, etc)
RUN apk add --no-cache python3 make g++

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

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
COPY --from=deps --chown=mockmail:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mockmail:nodejs /app/package.json ./package.json

# Copiar Prisma e arquivos gerados (diretórios garantidos no builder)
COPY --from=builder --chown=mockmail:nodejs /app/prisma ./prisma
COPY --from=builder --chown=mockmail:nodejs /app/src/generated ./src/generated

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
