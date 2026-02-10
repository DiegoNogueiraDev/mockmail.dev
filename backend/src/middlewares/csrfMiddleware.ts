/**
 * CSRF Protection Middleware for MockMail
 *
 * Implements Double Submit Cookie pattern:
 * 1. Server sets a CSRF token in a non-httpOnly cookie
 * 2. Client reads cookie and sends token in X-CSRF-Token header
 * 3. Server validates that both match
 *
 * This protects against CSRF attacks while allowing the frontend to read the token.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

// Configuration
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'mockmail_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
if (!process.env.CSRF_SECRET) {
  throw new Error("FATAL: CSRF_SECRET não configurado. Defina CSRF_SECRET no .env");
}
const CSRF_SECRET: string = process.env.CSRF_SECRET;

// Cookie settings
const getCookieOptions = () => ({
  httpOnly: false, // Must be readable by JavaScript
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  domain: process.env.COOKIE_DOMAIN || undefined,
});

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const data = `${timestamp}.${randomBytes}`;
  const signature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(data)
    .digest('hex')
    .substring(0, 16);

  return `${data}.${signature}`;
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const [timestamp, randomBytes, signature] = parts;
  const data = `${timestamp}.${randomBytes}`;

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(data)
    .digest('hex')
    .substring(0, 16);

  if (signature !== expectedSignature) {
    return false;
  }

  // Check token age (24 hours max)
  const tokenTime = parseInt(timestamp, 36);
  const maxAge = 24 * 60 * 60 * 1000;
  if (Date.now() - tokenTime > maxAge) {
    return false;
  }

  return true;
}

/**
 * Middleware to set CSRF token cookie
 * Call this on the CSRF token endpoint
 */
export function csrfTokenHandler(req: Request, res: Response): void {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions());
  res.json({ success: true, message: 'CSRF token set' });
}

/**
 * Middleware to validate CSRF token on state-changing requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF check for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // Skip CSRF check for certain paths (like initial login)
  const skipPaths = ['/api/auth/login', '/api/auth/register'];
  if (skipPaths.some((path) => req.path === path)) {
    return next();
  }

  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  // Get token from cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  // Validate tokens
  if (!headerToken || !cookieToken) {
    logger.warn(`CSRF: Missing token - header: ${!!headerToken}, cookie: ${!!cookieToken}`);
    res.status(403).json({
      success: false,
      error: 'CSRF token missing',
      message: 'Requisição inválida. Por favor, atualize a página.',
    });
    return;
  }

  // Tokens must match
  if (headerToken !== cookieToken) {
    logger.warn('CSRF: Token mismatch');
    res.status(403).json({
      success: false,
      error: 'CSRF token mismatch',
      message: 'Requisição inválida. Por favor, atualize a página.',
    });
    return;
  }

  // Validate token format and signature
  if (!validateCsrfToken(cookieToken)) {
    logger.warn('CSRF: Invalid token format or signature');
    res.status(403).json({
      success: false,
      error: 'CSRF token invalid',
      message: 'Token de segurança expirado. Por favor, atualize a página.',
    });
    return;
  }

  next();
}

export default csrfProtection;
