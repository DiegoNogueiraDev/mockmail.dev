import { Request, Response, NextFunction } from 'express';
import { UserRole, Permission } from '../models/User';
import logger from '../utils/logger';

/**
 * Middleware para verificar se o usuário tem um dos roles especificados
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      logger.warn('ROLE-MIDDLEWARE - Tentativa de acesso sem usuário autenticado');
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(user.role)) {
      logger.warn(`ROLE-MIDDLEWARE - Usuário ${user.email} (role: ${user.role}) tentou acessar recurso restrito a: ${roles.join(', ')}`);
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }

    next();
  };
};

/**
 * Middleware para verificar se o usuário tem uma permissão específica
 */
export const requirePermission = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      logger.warn('PERMISSION-MIDDLEWARE - Tentativa de acesso sem usuário autenticado');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verificar se o método hasPermission existe (usuário completo do banco)
    if (typeof user.hasPermission === 'function') {
      if (!user.hasPermission(permission)) {
        logger.warn(`PERMISSION-MIDDLEWARE - Usuário ${user.email} não tem permissão: ${permission}`);
        return res.status(403).json({ error: 'Forbidden: permission denied' });
      }
    } else {
      // Fallback: verificar permissões do role padrão
      const { ROLE_PERMISSIONS } = await import('../models/User');
      const rolePermissions = ROLE_PERMISSIONS[user.role as UserRole] || [];

      if (!rolePermissions.includes(permission)) {
        logger.warn(`PERMISSION-MIDDLEWARE - Usuário ${user.email} (role: ${user.role}) não tem permissão: ${permission}`);
        return res.status(403).json({ error: 'Forbidden: permission denied' });
      }
    }

    next();
  };
};

/**
 * Middleware para verificar se o usuário é admin ou system
 */
export const requireAdmin = requireRole('admin', 'system');

/**
 * Middleware para verificar se o usuário é system
 */
export const requireSystem = requireRole('system');
