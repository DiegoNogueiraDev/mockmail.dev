'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { initCsrf, getCsrfToken } from '@/lib/apiClient';

// CSRF Configuration
const CSRF_HEADER_NAME = 'x-csrf-token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Types
export type UserRole = 'user' | 'admin' | 'system';
export type Permission = 'read_emails' | 'write_emails' | 'admin_users' | 'admin_system';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Role to Permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: ['read_emails', 'write_emails'],
  admin: ['read_emails', 'write_emails', 'admin_users'],
  system: ['read_emails', 'write_emails', 'admin_users', 'admin_system'],
};

/**
 * AuthProvider - Gerencia autenticação usando httpOnly cookies
 *
 * SEGURANÇA: Tokens JWT são armazenados em cookies httpOnly pelo backend,
 * tornando-os inacessíveis ao JavaScript e protegendo contra XSS.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Verifica se o usuário está autenticado
   */
  const verifyAuth = useCallback(async (skipRefresh = false, isInitialCheck = false): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: getCsrfToken() || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user || data.data?.user || null);
        return true;
      } else if (response.status === 401) {
        if (!skipRefresh) {
          const refreshed = await tryRefreshToken(isInitialCheck);
          if (refreshed) {
            return verifyAuth(true, isInitialCheck);
          }
        }
        setUser(null);
        return false;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] Auth verification error:', error);
      setUser(null);
      return false;
    }
  }, []);

  /**
   * Tenta renovar o token usando refresh token
   */
  const tryRefreshToken = async (isInitialCheck = false): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: getCsrfToken() || '',
        },
      });

      if (response.ok) {
        if (!isInitialCheck) {
          console.log('[AuthContext] Token refreshed successfully');
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('[AuthContext] Token refresh error:', error);
      return false;
    }
  };

  /**
   * Inicializar autenticação
   */
  useEffect(() => {
    const initAuth = async () => {
      // Inicializar CSRF token antes de qualquer requisição autenticada
      await initCsrf();

      // Verificar autenticação via cookies
      await verifyAuth(false, true);

      setLoading(false);
    };

    initAuth();
  }, [verifyAuth]);

  /**
   * Login - envia credenciais e recebe cookies httpOnly
   */
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: getCsrfToken() || '',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao fazer login');
      }

      // Extrair dados do usuário
      const userData = data.user || data.data?.user;
      setUser(userData);

      // Redirecionar para o dashboard
      router.push('/admin/dashboard');
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      throw error;
    }
  };

  /**
   * Logout - limpa cookies no servidor
   */
  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: getCsrfToken() || '',
        },
      });
    } catch (error) {
      console.error('[AuthContext] Logout request failed:', error);
    }

    setUser(null);
    router.push('/login');
  };

  /**
   * Refresh manual da autenticação
   */
  const refreshAuth = async (): Promise<boolean> => {
    return verifyAuth();
  };

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;

    // Verificar permissões explícitas do usuário
    if (user.permissions?.includes(permission)) {
      return true;
    }

    // Verificar permissões do role
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    return rolePermissions.includes(permission);
  };

  /**
   * Verifica se o usuário tem um dos roles especificados
   */
  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    loading,
    isLoading: loading,
    login,
    logout,
    refreshAuth,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook para usar o contexto de autenticação
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}

/**
 * HOC para proteger componentes que requerem autenticação
 */
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: { requiredRole?: UserRole; requiredPermission?: Permission }
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, loading, hasRole, hasPermission } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !isAuthenticated) {
        router.push('/login');
      }

      if (!loading && isAuthenticated) {
        if (options?.requiredRole && !hasRole(options.requiredRole)) {
          router.push('/admin/dashboard');
        }
        if (options?.requiredPermission && !hasPermission(options.requiredPermission)) {
          router.push('/admin/dashboard');
        }
      }
    }, [loading, isAuthenticated, router, hasRole, hasPermission]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="loading-spinner" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

export default AuthContext;
