# Frontend Dashboard - Estrutura (frontend/)

## Tech Stack
Next.js 15, React 19, Tailwind v4, Recharts, Lucide Icons

## Páginas Admin (app/admin/)
- dashboard/page.tsx - Dashboard principal
- boxes/ - Listar, ver [id], criar new
- emails/ - Listar, ver [id]
- webhooks/ - Listar, ver [id], criar new
- api-keys/ - Listar, criar new
- profile/, settings/
- system/ - Admin: boxes, sessions, stats, users/[id]

## Páginas Públicas (app/)
- page.tsx - Landing, login/, register/
- boxes/ - Visualização pública
- docs/api/ - Documentação API
- tracking/ - Rastreamento de emails

## API Routes (app/api/)
- chart-data, daily-stats, email-boxes
- errors, health, metrics, track

## Components Principais
- Dashboard.tsx, LandingPage.tsx, EmailBoxesView.tsx
- EmailFlowVisualization.tsx, EmailMetricsChart.tsx
- DailyStatsCard.tsx, MetricCard.tsx, ExpirationTimer.tsx
- ConfirmModal.tsx, SkeletonLoader.tsx
- ApiEndpointStatus.tsx, RecentErrors.tsx, SystemStatus.tsx
- dashboard/ - Sub-componentes

## Outros Diretórios
- contexts/, hooks/, lib/, types/
- middleware.ts - Next.js middleware
