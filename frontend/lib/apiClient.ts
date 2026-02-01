/**
 * API Client - MockMail
 *
 * Cliente HTTP centralizado com suporte a:
 * - CSRF protection via cookies + headers
 * - HTTP-only cookies para tokens JWT
 * - Auto-refresh de tokens expirados
 * - Retry automático em caso de refresh
 *
 * SEGURANÇA:
 * - Cookies httpOnly protegem contra XSS
 * - Token CSRF protege contra CSRF
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// CSRF Configuration
const CSRF_COOKIE_NAME = 'mockmail_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Lê o valor de um cookie pelo nome
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
}

/**
 * Obtém o token CSRF do cookie
 */
export function getCsrfToken(): string | null {
  return getCookie(CSRF_COOKIE_NAME);
}

// Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{ path: string; message: string }>;
}

export interface ApiError extends Error {
  status: number;
  data?: ApiResponse;
}

/**
 * Cria erro padronizado da API
 */
function createApiError(message: string, status: number, data?: ApiResponse): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.data = data;
  return error;
}

/**
 * Tenta renovar o token usando refresh token
 */
async function tryRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        [CSRF_HEADER_NAME]: getCsrfToken() || '',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Handler padrão de respostas
 */
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  // Token expirado - tentar refresh
  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (!refreshed) {
      // Redirecionar para login se refresh falhar
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw createApiError('Sessão expirada. Faça login novamente.', 401);
    }
    // Sinaliza que token foi renovado para retry
    throw createApiError('TOKEN_REFRESHED', 401);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createApiError(
      data.message || data.error || `Erro HTTP ${response.status}`,
      response.status,
      data
    );
  }

  return data;
}

/**
 * Headers padrão para requisições JSON
 * Inclui CSRF token para métodos que modificam dados
 */
function getHeaders(customHeaders?: HeadersInit, method: string = 'GET'): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Adiciona CSRF token para métodos que modificam dados
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  if (needsCsrf) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      (headers as Record<string, string>)[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  return headers;
}

/**
 * Realiza requisição com retry automático após refresh de token
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = 1
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // SEMPRE envia cookies
    });
    return handleResponse<T>(response);
  } catch (error) {
    // Se foi um refresh bem sucedido, tentar novamente
    if (error instanceof Error && error.message === 'TOKEN_REFRESHED' && retries > 0) {
      return fetchWithRetry<T>(url, options, retries - 1);
    }
    throw error;
  }
}

/**
 * API Client com métodos HTTP
 */
export const api = {
  /**
   * GET request
   */
  async get<T = unknown>(
    endpoint: string,
    options?: { headers?: HeadersInit; params?: Record<string, string | number | boolean | undefined> }
  ): Promise<ApiResponse<T>> {
    let url = `${API_URL}${endpoint}`;

    // Adiciona query params se fornecidos
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return fetchWithRetry<T>(url, {
      method: 'GET',
      headers: getHeaders(options?.headers),
    });
  },

  /**
   * POST request
   */
  async post<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: { headers?: HeadersInit }
  ): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(options?.headers, 'POST'),
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * PUT request
   */
  async put<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: { headers?: HeadersInit }
  ): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(options?.headers, 'PUT'),
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: { headers?: HeadersInit }
  ): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getHeaders(options?.headers, 'PATCH'),
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    endpoint: string,
    options?: { headers?: HeadersInit; body?: unknown }
  ): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(options?.headers, 'DELETE'),
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  },

  /**
   * URL base da API (útil para casos especiais)
   */
  baseUrl: API_URL,
};

/**
 * Inicializa o token CSRF fazendo uma requisição para obter o cookie
 * IMPORTANTE: Deve ser chamado antes de qualquer requisição autenticada
 */
export async function initCsrf(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/csrf-token`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch (error) {
    console.warn('[CSRF] Failed to initialize CSRF token:', error);
  }
}

/**
 * Utilitário para verificar se está autenticado
 */
export async function checkAuth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/auth/verify`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        [CSRF_HEADER_NAME]: getCsrfToken() || '',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default api;
