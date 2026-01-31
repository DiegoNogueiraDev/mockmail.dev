import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware para proteção de rotas MockMail
 *
 * IMPORTANTE: Este middleware roda no Edge Runtime e tem acesso limitado.
 * Não conseguimos validar JWT aqui (falta crypto), mas podemos:
 * 1. Verificar se o cookie de access_token existe
 * 2. Redirecionar para login se não existir
 *
 * A validação real do token acontece no backend via API.
 */

// Rotas públicas (não requerem autenticação)
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/csrf-token',
  '/api/health',
];

// Rotas estáticas que não devem ser interceptadas
const STATIC_ROUTES = [
  '/_next',
  '/favicon',
  '/static',
  '/images',
  '/public',
];

// Nome do cookie de access token (mesmo do backend)
const ACCESS_TOKEN_COOKIE = 'mockmail_access_token';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Ignorar rotas estáticas
  if (STATIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // 2. Permitir rotas públicas
  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // 3. Verificar se existe cookie de autenticação
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE);

  // 4. Se não está autenticado e tenta acessar área protegida
  if (!accessToken && pathname.startsWith('/admin')) {
    const loginUrl = new URL('/login', request.url);
    // Salvar URL original para redirect após login
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Se está na raiz, redirecionar baseado no status de autenticação
  if (pathname === '/') {
    if (accessToken) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 6. Se está autenticado e tenta acessar login, redirecionar para dashboard
  if (accessToken && pathname === '/login') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // 7. Proteger rotas de API que não são públicas
  if (pathname.startsWith('/api/') && !PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    // API routes são protegidas pelo authMiddleware no backend
    return NextResponse.next();
  }

  // 8. Permitir acesso
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$).*)',
  ],
};
