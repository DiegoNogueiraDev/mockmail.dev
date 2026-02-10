import { Request, Response } from "express";
import {
  findUserByEmail,
  findUserById,
  createUser,
  comparePassword,
} from "../services/user.service";
import { generateTokenPair, verifyAccessToken, blacklistToken, refreshTokens } from "../services/token.service";
import UserSession from "../models/UserSession";
import logger from "../utils/logger";

// Cookie configuration for httpOnly tokens
const getAuthCookieOptions = () => ({
  httpOnly: true, // Cannot be accessed by JavaScript
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
  path: '/',
  domain: process.env.COOKIE_DOMAIN || undefined,
});

const ACCESS_TOKEN_COOKIE = 'mockmail_access_token';
const REFRESH_TOKEN_COOKIE = 'mockmail_refresh_token';
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Função auxiliar para sanitizar entrada
const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>\"'%;&()]/g, '');
};

// Função auxiliar para validar email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Política de senha forte (NIST SP 800-63B + OWASP)
const PASSWORD_POLICY = {
  MIN_LENGTH: 12,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
} as const;

interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];

  if (password.length < PASSWORD_POLICY.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters`);
  }
  if (PASSWORD_POLICY.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (PASSWORD_POLICY.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (PASSWORD_POLICY.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (PASSWORD_POLICY.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Validação de entrada aprimorada
  if (!email || !password) {
    logger.warn(`CONTROL-AUTH - Login falhou: Campos obrigatórios ausentes`);
    return res.status(400).json({ error: "Preencha o email e a senha para continuar." });
  }

  if (!isValidEmail(email)) {
    logger.warn(`CONTROL-AUTH - Login falhou: Email inválido: ${email}`);
    return res.status(400).json({ error: "O formato do email é inválido." });
  }

  const sanitizedEmail = sanitizeInput(email);
  logger.info(`CONTROL-AUTH - Tentativa de login com o email: ${sanitizedEmail}`);

  try {
    // Verificando se o usuário existe
    const user = await findUserByEmail(sanitizedEmail);
    if (!user) {
      logger.warn(
        `CONTROL-AUTH - Login falhou: Usuário não encontrado para o email: ${sanitizedEmail}`
      );
      // Mensagem genérica por segurança (não revelar se email existe)
      return res.status(401).json({ error: "Email ou senha incorretos." });
    }

    // Validando a senha
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      logger.warn(
        `CONTROL-AUTH - Login falhou: Credenciais inválidas para o email: ${sanitizedEmail}`
      );
      return res.status(401).json({ error: "Email ou senha incorretos." });
    }

    // Gerando par de tokens (access + refresh)
    const tokens = await generateTokenPair(user.id);

    // Registrar sessão de login
    try {
      await UserSession.createSession(user.id, {
        ip: req.ip || req.headers['x-forwarded-for'] as string,
        headers: req.headers as Record<string, string | string[] | undefined>
      });
      // Atualizar lastLogin do usuário
      await user.updateOne({ lastLogin: new Date() });
    } catch (sessionError) {
      logger.warn(`CONTROL-AUTH - Falha ao registrar sessão: ${(sessionError as Error).message}`);
      // Não falha o login se a sessão não puder ser criada
    }

    logger.info(`CONTROL-AUTH - Login bem-sucedido para o email: ${sanitizedEmail}`);

    // Set httpOnly cookies for tokens
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...getAuthCookieOptions(),
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...getAuthCookieOptions(),
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    // Return user data (without password) for frontend state
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        permissions: user.permissions || ['read_emails', 'write_emails'],
      },
      // Backward compatibility: also return tokens for API clients
      token: tokens.accessToken,
      ...tokens,
    });
  } catch (error) {
    logger.error(`CONTROL-AUTH - Erro no login para o email: ${sanitizedEmail}`);
    logger.error(`Detalhes do erro: ${(error as Error).message}`);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  // Validação de entrada aprimorada
  if (!email || !password || !name) {
    logger.warn(`CONTROL-AUTH - Registro falhou: Campos obrigatórios ausentes`);
    return res.status(400).json({
      error: "Preencha todos os campos obrigatórios: nome, email e senha."
    });
  }

  if (!isValidEmail(email)) {
    logger.warn(`CONTROL-AUTH - Registro falhou: Email inválido: ${email}`);
    return res.status(400).json({
      error: "O formato do email é inválido. Verifique e tente novamente."
    });
  }

  // Validação de senha forte
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    logger.warn(`CONTROL-AUTH - Registro falhou: Senha não atende aos requisitos`);
    return res.status(400).json({
      error: "A senha não atende aos requisitos de segurança.",
      details: passwordValidation.errors
    });
  }

  const sanitizedEmail = sanitizeInput(email);
  const sanitizedName = sanitizeInput(name);

  logger.info(`CONTROL-AUTH - Tentativa de registro com o email: ${sanitizedEmail}`);

  try {
    // Verificar se usuário já existe
    const existingUser = await findUserByEmail(sanitizedEmail);
    if (existingUser) {
      logger.warn(`CONTROL-AUTH - Registro falhou: Usuário já existe: ${sanitizedEmail}`);
      return res.status(409).json({
        error: "Este email já está cadastrado. Tente fazer login ou use outro email."
      });
    }

    // Criando o usuário
    const user = await createUser(sanitizedEmail, password, sanitizedName);
    logger.info(`CONTROL-AUTH - Usuário registrado com sucesso: ${user.email}`);
    res.status(201).json(user);
  } catch (error) {
    logger.error(
      `CONTROL-AUTH - Erro ao registrar usuário com o email: ${sanitizedEmail}`
    );
    logger.error(
      `CONTROL-AUTH - Detalhes do erro: ${(error as Error).message}`
    );

    // Retornar 400 para erros de validação conhecidos em vez de 500
    if ((error as Error).message.includes('validation') ||
        (error as Error).message.includes('required') ||
        (error as Error).message.includes('duplicate')) {
      return res.status(400).json({
        error: "Erro ao processar os dados. Verifique as informações e tente novamente."
      });
    }

    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
};


/**
 * Get current authenticated user
 */
export const me = async (req: Request, res: Response) => {
  try {
    // Token from httpOnly cookie or Authorization header
    const accessToken = req.cookies?.[ACCESS_TOKEN_COOKIE] ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    // Get user from database using ID
    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    logger.info(`CONTROL-AUTH - User info retrieved: ${user.email}`);
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        permissions: user.permissions || ['read_emails', 'write_emails'],
      },
    });
  } catch (error) {
    logger.error(`CONTROL-AUTH - Error getting user info: ${(error as Error).message}`);
    res.status(401).json({
      success: false,
      message: "Authentication failed"
    });
  }
};

/**
 * Refresh access token using refresh token
 */
export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required"
      });
    }

    // Use refreshTokens which verifies with JWT_REFRESH_SECRET correctly
    const tokens = await refreshTokens(refreshToken);

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token"
      });
    }

    // Set new httpOnly cookies
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...getAuthCookieOptions(),
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...getAuthCookieOptions(),
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    logger.info(`CONTROL-AUTH - Token refreshed successfully`);
    res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    logger.error(`CONTROL-AUTH - Error refreshing token: ${(error as Error).message}`);
    res.status(401).json({
      success: false,
      message: "Token refresh failed"
    });
  }
};

/**
 * Logout user and clear cookies
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    // Try to get user ID to end session
    const user = (req as any).user;
    const userId = user?._id || user?.id;

    // End user session
    if (userId) {
      try {
        await UserSession.endSession(userId, 'logged_out');
        logger.info(`CONTROL-AUTH - Session ended for user ${userId}`);
      } catch (sessionError) {
        logger.warn(`CONTROL-AUTH - Failed to end session: ${(sessionError as Error).message}`);
      }
    }

    // Blacklist tokens if available
    if (accessToken) {
      await blacklistToken(accessToken).catch((err) => {
        logger.warn(`CONTROL-AUTH - Falha ao invalidar access token no logout: ${err instanceof Error ? err.message : err}`);
      });
    }
    if (refreshToken) {
      await blacklistToken(refreshToken).catch((err) => {
        logger.warn(`CONTROL-AUTH - Falha ao invalidar refresh token no logout: ${err instanceof Error ? err.message : err}`);
      });
    }

    // Clear cookies
    res.clearCookie(ACCESS_TOKEN_COOKIE, getAuthCookieOptions());
    res.clearCookie(REFRESH_TOKEN_COOKIE, getAuthCookieOptions());

    logger.info(`CONTROL-AUTH - User logged out`);
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    logger.error(`CONTROL-AUTH - Error during logout: ${(error as Error).message}`);
    // Still clear cookies even if blacklisting fails
    res.clearCookie(ACCESS_TOKEN_COOKIE, getAuthCookieOptions());
    res.clearCookie(REFRESH_TOKEN_COOKIE, getAuthCookieOptions());
    res.status(200).json({
      success: true,
      message: "Logged out"
    });
  }
};
