# Frontend Dashboard - Estrutura (atualizado 2026-02-10)

## Tech Stack
Next.js 15, React 19, Tailwind v4, Recharts, Lucide Icons

## Middleware
- middleware.ts - Auth check, rotas públicas/protegidas, cookies (ACCESS_TOKEN_COOKIE)

## Páginas Admin (app/admin/)
- layout.tsx - Layout admin com sidebar
- error.tsx - Error boundary do admin
- dashboard/page.tsx - Dashboard principal
- boxes/ - Listar, ver [id], criar new
- emails/ - Listar, ver [id]
- webhooks/ - Listar, ver [id], criar new
- api-keys/ - Listar, criar new
- profile/ - Perfil do usuário
- settings/ - Configurações
- system/ - Painel Admin: boxes, sessions, stats, users/[id]

## Páginas Públicas (app/)
- page.tsx - Landing page
- login/page.tsx - Login
- register/page.tsx - Registro
- boxes/ - Visualização pública (layout.tsx + page.tsx)
- docs/api/page.tsx - Documentação API
- tracking/page.tsx - Rastreamento de emails
- error.tsx - Error boundary global

## API Routes (app/api/)
- chart-data/route.ts
- daily-stats/route.ts
- email-boxes/route.ts
- errors/route.ts
- health/route.ts
- metrics/route.ts
- track/route.ts

## Components Principais (components/)
- Dashboard.tsx - Dashboard completo
- LandingPage.tsx - Página inicial
- EmailBoxesView.tsx - Lista de caixas
- EmailFlowVisualization.tsx - Fluxo visual de emails
- EmailMetricsChart.tsx - Gráficos de métricas (Recharts)
- DailyStatsCard.tsx - Card de stats diários
- MetricCard.tsx - Card de métrica genérico
- ExpirationTimer.tsx - Timer de expiração animado
- ConfirmModal.tsx - Modal de confirmação
- SkeletonLoader.tsx - Skeleton loading
- ApiEndpointStatus.tsx - Status de endpoints
- RecentErrors.tsx - Erros recentes
- SystemStatus.tsx - Status do sistema
- dashboard/RecentEmailsCard.tsx - Card de emails recentes

## Contexts
- contexts/AuthContext.tsx - Contexto de autenticação

## Hooks
- hooks/useEmailTracking.ts - Rastreamento de emails
- hooks/useInfiniteScroll.ts - Scroll infinito
- lib/hooks/useMetrics.ts - Hook de métricas

## Lib/Utils
- lib/apiClient.ts - Cliente HTTP para API backend
- lib/logParser.ts - Parser de logs
- lib/utils/dateFormatter.ts - Formatação de datas

## Types
- types/email.ts - Tipos de email
