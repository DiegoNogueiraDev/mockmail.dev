import { Request, Response } from "express";
import {
  findUserByEmail,
  createUser,
  comparePassword,
} from "../services/user.service";
import { generateTokenPair } from "../services/token.service";
import logger from "../utils/logger";

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
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (!isValidEmail(email)) {
    logger.warn(`CONTROL-AUTH - Login falhou: Email inválido: ${email}`);
    return res.status(400).json({ message: "Invalid email format" });
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
      return res.status(404).json({ message: "User not found" });
    }

    // Validando a senha
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      logger.warn(
        `CONTROL-AUTH - Login falhou: Credenciais inválidas para o email: ${sanitizedEmail}`
      );
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Gerando par de tokens (access + refresh)
    const tokens = await generateTokenPair(user.id);
    logger.info(`CONTROL-AUTH - Login bem-sucedido para o email: ${sanitizedEmail}`);
    // Retorna compatível com versão antiga (token) + novos campos (accessToken, refreshToken)
    res.status(200).json({
      token: tokens.accessToken, // Backward compatibility
      ...tokens,
    });
  } catch (error) {
    logger.error(`CONTROL-AUTH - Erro no login para o email: ${sanitizedEmail}`);
    logger.error(`Detalhes do erro: ${(error as Error).message}`);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  
  // Validação de entrada aprimorada
  if (!email || !password || !name) {
    logger.warn(`CONTROL-AUTH - Registro falhou: Campos obrigatórios ausentes`);
    return res.status(400).json({ 
      message: "Erro de validação",
      details: ["Email, password and name are required"]
    });
  }

  if (!isValidEmail(email)) {
    logger.warn(`CONTROL-AUTH - Registro falhou: Email inválido: ${email}`);
    return res.status(400).json({ 
      message: "Erro de validação",
      details: ["Invalid email format"]
    });
  }

  // Validação de senha forte
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    logger.warn(`CONTROL-AUTH - Registro falhou: Senha não atende aos requisitos`);
    return res.status(400).json({
      message: "Erro de validação",
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
        message: "Erro de validação",
        details: ["User already exists"]
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
        message: "Erro de validação",
        details: [(error as Error).message]
      });
    }
    
    res.status(500).json({ message: "Internal server error" });
  }
};
