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


/**
 * Find user by ID
 */
export const findUserById = async (id: string) => {
  try {
    logger.info(`SERVICE-USER - Buscando usuário pelo ID: ${id}`);
    const user = await User.findById(id);
    if (user) {
      logger.info(`SERVICE-USER - Usuário encontrado: ${user.email}`);
    } else {
      logger.warn(`SERVICE-USER - Nenhum usuário encontrado para o ID: ${id}`);
    }
    return user;
  } catch (error) {
    logger.error(
      `SERVICE-USER - Erro ao buscar usuário por ID: ${(error as Error).message}`
    );
    throw new Error("SERVICE-USER - Erro ao buscar usuário por ID.");
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

/**
 * Update user profile (name only - email changes require verification)
 */
export const updateUserProfile = async (
  userId: string,
  updates: { name?: string }
) => {
  try {
    logger.info(`SERVICE-USER - Atualizando perfil do usuário ID: ${userId}`);

    const updateData: { name?: string } = {};
    if (updates.name?.trim()) {
      updateData.name = updates.name.trim();
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("Nenhum dado para atualizar");
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    logger.info(`SERVICE-USER - Perfil atualizado: ${user.email}`);
    return user;
  } catch (error) {
    logger.error(
      `SERVICE-USER - Erro ao atualizar perfil: ${(error as Error).message}`
    );
    throw error;
  }
};

/**
 * Change user password with current password validation
 */
export const changeUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  try {
    logger.info(`SERVICE-USER - Alterando senha do usuário ID: ${userId}`);

    // Get user with password
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new Error("Senha atual incorreta");
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(", "));
    }

    // Hash and save new password
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    logger.info(`SERVICE-USER - Senha alterada com sucesso: ${user.email}`);
    return true;
  } catch (error) {
    logger.error(
      `SERVICE-USER - Erro ao alterar senha: ${(error as Error).message}`
    );
    throw error;
  }
};

/**
 * Validate password strength (NIST SP 800-63B compliant)
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const MIN_LENGTH = 12;

  if (password.length < MIN_LENGTH) {
    errors.push(`Senha deve ter pelo menos ${MIN_LENGTH} caracteres`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Senha deve conter pelo menos uma letra maiúscula");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Senha deve conter pelo menos uma letra minúscula");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Senha deve conter pelo menos um número");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Senha deve conter pelo menos um caractere especial");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Get user statistics
 */
export const getUserStats = async (userId: string) => {
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return null;
    }

    // Count email boxes for this user
    const EmailBox = (await import("../models/EmailBox")).default;
    const boxCount = await EmailBox.countDocuments({ userId });

    // Count API keys for this user
    const ApiKey = (await import("../models/ApiKey")).default;
    const apiKeyCount = await ApiKey.countDocuments({ userId });

    // Count webhooks for this user
    const Webhook = (await import("../models/Webhook")).default;
    const webhookCount = await Webhook.countDocuments({ userId });

    return {
      boxCount,
      apiKeyCount,
      webhookCount,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    };
  } catch (error) {
    logger.error(
      `SERVICE-USER - Erro ao buscar estatísticas: ${(error as Error).message}`
    );
    return null;
  }
};
