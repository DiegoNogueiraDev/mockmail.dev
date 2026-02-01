import { Request, Response } from "express";
import {
  findUserById,
  updateUserProfile,
  changeUserPassword,
  getUserStats,
  validatePasswordStrength,
} from "../services/user.service";
import { revokeAllUserTokens } from "../services/token.service";
import logger from "../utils/logger";

/**
 * Get current user profile with statistics
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Não autenticado",
      });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado",
      });
    }

    const stats = await getUserStats(userId);

    logger.info(`CONTROL-PROFILE - Perfil obtido: ${user.email}`);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        stats,
      },
    });
  } catch (error) {
    logger.error(`CONTROL-PROFILE - Erro ao obter perfil: ${(error as Error).message}`);
    res.status(500).json({
      success: false,
      error: "Erro ao obter perfil",
    });
  }
};

/**
 * Update user profile (name)
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Não autenticado",
      });
    }

    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Nome é obrigatório",
      });
    }

    if (name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: "Nome deve ter pelo menos 3 caracteres",
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        error: "Nome não pode ter mais de 100 caracteres",
      });
    }

    const updatedUser = await updateUserProfile(userId, { name: name.trim() });

    logger.info(`CONTROL-PROFILE - Perfil atualizado: ${updatedUser.email}`);

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
      },
      message: "Perfil atualizado com sucesso",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro ao atualizar perfil";
    logger.error(`CONTROL-PROFILE - Erro: ${errorMsg}`);
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
};

/**
 * Change user password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Não autenticado",
      });
    }

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Todos os campos são obrigatórios",
      });
    }

    // Check password confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Nova senha e confirmação não coincidem",
      });
    }

    // Validate password strength before attempting change
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: "Senha não atende aos requisitos",
        details: validation.errors,
      });
    }

    // Attempt to change password
    await changeUserPassword(userId, currentPassword, newPassword);

    // Optionally revoke all other sessions for security
    // await revokeAllUserTokens(userId);

    logger.info(`CONTROL-PROFILE - Senha alterada para usuário ID: ${userId}`);

    res.json({
      success: true,
      message: "Senha alterada com sucesso",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro ao alterar senha";
    logger.error(`CONTROL-PROFILE - Erro ao alterar senha: ${errorMsg}`);

    // Return appropriate status code
    if (errorMsg.includes("incorreta")) {
      return res.status(401).json({
        success: false,
        error: errorMsg,
      });
    }

    res.status(400).json({
      success: false,
      error: errorMsg,
    });
  }
};

/**
 * Get password requirements (for frontend validation hints)
 */
export const getPasswordRequirements = async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: true,
      specialChars: '!@#$%^&*(),.?":{}|<>',
    },
  });
};
