import { Request, Response } from "express";
import {
  findUserByEmail,
  createUser,
  comparePassword,
  generateToken,
} from "../services/user.service";
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

    // Gerando o token
    const token = generateToken(user.id);
    logger.info(`CONTROL-AUTH - Login bem-sucedido para o email: ${sanitizedEmail}`);
    res.status(200).json({ token });
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

  if (password.length < 6) {
    logger.warn(`CONTROL-AUTH - Registro falhou: Senha muito curta`);
    return res.status(400).json({ 
      message: "Erro de validação",
      details: ["Password must be at least 6 characters long"]
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
