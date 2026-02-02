import sanitizeHtml from 'sanitize-html';
import logger from './logger';

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape' as const
};

export const sanitizeString = (input: any): string => {
  if (typeof input !== 'string') {
    return '';
  }
  
  let sanitized = sanitizeHtml(input, sanitizeOptions);
  sanitized = sanitized.replace(/[<>"'%;()&+]/g, '').trim();
  
  return sanitized;
};

export const sanitizeEmail = (email: any): string => {
  if (typeof email !== 'string') {
    return '';
  }
  
  let sanitized = email.toLowerCase().trim();
  sanitized = sanitized.replace(/[<>"'%;()&+\\]/g, '');
  
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    logger.warn(`SANITIZE - Email inválido após sanitização`);
    return '';
  }
  
  return sanitized;
};

export const sanitizeObject = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(obj[key]);
    }
  }
  
  return sanitized;
};

export const detectNoSQLInjection = (input: any): boolean => {
  if (typeof input === 'object' && input !== null) {
    const keys = Object.keys(input);
    const dangerousOperators = ['$where', '$ne', '$gt', '$lt', '$regex', '$or', '$and', '$in', '$nin'];
    
    for (const key of keys) {
      if (dangerousOperators.includes(key)) {
        logger.warn(`SECURITY - NoSQL injection detectado: operador ${key}`);
        return true;
      }
      
      if (typeof input[key] === 'object') {
        if (detectNoSQLInjection(input[key])) {
          return true;
        }
      }
    }
  }
  
  return false;
};

export const sanitizeMiddleware = (req: any, res: any, next: any) => {
  try {
    if (req.body && detectNoSQLInjection(req.body)) {
      logger.error(`SECURITY - NoSQL injection bloqueado de IP: ${req.ip}`);
      return res.status(400).json({ 
        message: 'Invalid request: potential security threat detected' 
      });
    }
    
    next();
  } catch (error) {
    logger.error(`SANITIZE - Erro: ${(error as Error).message}`);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export default {
  sanitizeString,
  sanitizeEmail,
  sanitizeObject,
  detectNoSQLInjection,
  sanitizeMiddleware
};
