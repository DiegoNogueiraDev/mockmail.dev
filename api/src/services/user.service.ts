import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import logger from "../utils/logger"; // Importação do logger

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "defaultSecret";

// Função para gerar hash da senha
export const hashPassword = async (password: string): Promise<string> => {
  try {
    logger.info("SERVICE-USER - Iniciando hashing da senha.");
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    logger.info("SERVICE-USER - Hashing da senha concluído.");
    return hashedPassword;
  } catch (error) {
    logger.error(
      `SERVICE-USER - Erro ao hashear senha: ${(error as Error).message}`
    );
    throw new Error("SERVICE-USER - Erro ao processar a senha.");
  }
};

// Função para comparar senha com hash
export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  try {
    logger.info("SERVICE-USER - Comparando senha com hash.");
    const isMatch = await bcrypt.compare(password, hash);
    logger.info(
      `SERVICE-USER - Comparação concluída: ${
        isMatch ? "senhas coincidem" : "senhas não coincidem"
      }.`
    );
    return isMatch;
  } catch (error) {
    logger.error(
      `SERVICE-USER - Erro ao comparar senha: ${(error as Error).message}`
    );
    throw new Error("SERVICE-USER - Erro ao validar a senha.");
  }
};

// Função para gerar token JWT
export const generateToken = (userId: string): string => {
  try {
    logger.info(
      `SERVICE-USER - Gerando token JWT para o usuário ID: ${userId}`
    );
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "24h" });
    logger.info("SERVICE-USER - Token JWT gerado com sucesso.");
    return token;
  } catch (error) {
    logger.error(
      `SERVICE-USER - Erro ao gerar token JWT: ${(error as Error).message}`
    );
    throw new Error("SERVICE-USER - Erro ao gerar token de autenticação.");
  }
};

// Função para buscar usuário por e-mail
export const findUserByEmail = async (email: string) => {
  try {
    logger.info(`SERVICE-USER - Buscando usuário pelo e-mail: ${email}`);
    const user = await User.findOne({ email });
    if (user) {
      logger.info(`SERVICE-USER - Usuário encontrado: ${user.email}`);
    } else {
      logger.warn(
        `SERVICE-USER - Nenhum usuário encontrado para o e-mail: ${email}`
      );
    }
    return user;
  } catch (error) {
    logger.error(
      `SERVICE-USER - Erro ao buscar usuário: ${(error as Error).message}`
    );
    throw new Error("SERVICE-USER - Erro ao buscar usuário.");
  }
};

// Função para criar novo usuário
export const createUser = async (
  email: string,
  password: string,
  name: string
) => {
  try {
    logger.info(
      `SERVICE-USER - Iniciando criação de usuário com e-mail: ${email}`
    );
    logger.info(`SERVICE-USER - Usuário: ${name} - E-mail: ${email}`);
    const hashedPassword = await hashPassword(password);
    const user = new User({ email, password: hashedPassword, name });
    const savedUser = await user.save();
    logger.info(
      `SERVICE-USER - Usuário criado com sucesso: ${savedUser.email}`
    );
    return savedUser;
  } catch (error) {
    logger.error(
      `SERVICE-USER - Erro ao criar usuário: ${(error as Error).message}`
    );
    throw new Error("SERVICE-USER - Erro ao criar usuário.");
  }
};
