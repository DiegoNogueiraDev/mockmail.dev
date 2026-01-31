import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas públicas que não requerem autenticação
const PUBLIC_ROUTES = [
  '/api/health',
  '/_next',
  '/favicon.ico',
];

// Verificar se a rota é pública
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rotas públicas
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Apenas proteger rotas de API
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Extrair token do header Authorization
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized: No token provided' },
      { status: 401 }
    );
  }

  // Validar token com a API principal
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Invalid token' }));
      return NextResponse.json(
        { error: error.message || 'Invalid token' },
        { status: 401 }
      );
    }

    // Token válido - adicionar info do usuário ao header para downstream
    const userData = await response.json();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', userData.user?.id || '');
    requestHeaders.set('x-user-email', userData.user?.email || '');
    requestHeaders.set('x-user-role', userData.user?.role || 'user');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Auth middleware error:', error);

    // Se a API principal estiver indisponível, permitir em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.warn('Auth API unavailable in development - allowing request');
      return NextResponse.next();
    }

    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 503 }
    );
  }
}

export const config = {
  matcher: [
    // Proteger todas as rotas de API exceto health
    '/api/:path*',
  ],
};
