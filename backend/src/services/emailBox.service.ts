import EmailBox from "../models/EmailBox";
import logger from "../utils/logger";
import Email from "../models/Email";

/**
 * Verifica se uma caixa de e-mail já existe associada ao usuário.
 * Caso não exista, cria uma nova.

 *
 * @param address - Endereço da caixa de e-mail (campo `to` do payload).
 * @param userId - ID do usuário associado.
 * @returns A caixa de e-mail encontrada ou criada.
 */
export const findOrCreateEmailBox = async (address: string, userId: string, isCustom: boolean = false) => {
  try {
    // Busca por address (agora é único globalmente)
    let emailBox = await EmailBox.findOne({ address });

    if (!emailBox) {
      logger.info(
        `SERVICE-EMAILBOX - Criando nova caixa de e-mail para o usuário ${userId} com endereço: ${address}`
      );

      // Calcula expiração: 24 horas a partir de agora
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      emailBox = new EmailBox({
        address,
        userId,
        isCustom,
        expiresAt,
      });
      await emailBox.save();

      logger.info(
        `SERVICE-EMAILBOX - Caixa criada com expiração em: ${expiresAt.toISOString()}`
      );
    } else {
      // Caixa já existe - verificar se precisa renovar a expiração
      const now = new Date();
      const isExpired = emailBox.expiresAt && new Date(emailBox.expiresAt) <= now;

      if (isExpired || !emailBox.expiresAt) {
        // Renovar expiração para mais 24 horas quando recebe novo email
        const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        emailBox.expiresAt = newExpiresAt;
        await emailBox.save();

        logger.info(
          `SERVICE-EMAILBOX - Caixa reativada: ${address} - Nova expiração: ${newExpiresAt.toISOString()}`
        );
      } else {
        logger.info(
          `SERVICE-EMAILBOX - Caixa de e-mail já existe e está ativa: ${address}`
        );
      }
    }

    return emailBox;
  } catch (error) {
    logger.error(
      `SERVICE-EMAILBOX - Erro ao buscar ou criar caixa de e-mail: ${
        (error as Error).message
      }`
    );
    throw new Error(
      "SERVICE-EMAILBOX - Erro interno ao processar caixa de e-mail"
    );
  }
};;


/**
 * Busca uma caixa de e-mail pelo endereço (para uso no email-processor).
 * Retorna o EmailBox com o userId populado se encontrado.
 *
 * @param address - Endereço da caixa de e-mail
 * @returns O EmailBox encontrado ou null
 */
export const findEmailBoxByAddress = async (address: string) => {
  try {
    const emailBox = await EmailBox.findOne({ address }).populate("userId");

    if (emailBox) {
      logger.info(
        `SERVICE-EMAILBOX - Caixa de e-mail encontrada: ${address}`
      );
    } else {
      logger.warn(
        `SERVICE-EMAILBOX - Caixa de e-mail não encontrada: ${address}`
      );
    }

    return emailBox;
  } catch (error) {
    logger.error(
      `SERVICE-EMAILBOX - Erro ao buscar caixa de e-mail: ${
        (error as Error).message
      }`
    );
    throw new Error("SERVICE-EMAILBOX - Erro interno ao buscar caixa de e-mail");
  }
};

// Função para buscar o e-mail mais novo por assunto
export const getLatestEmailBySubjectService = async (
  userEmail: string,
  address: string,
  subject: string
) => {
  try {
    // Log para debug
    logger.info(
      `SERVICE-EMAIL - Iniciando busca com parâmetros: from=${userEmail}, to=${address}, subject=${subject}`
    );

    const email = await Email.findOne({
      from: userEmail,
      to: address,
      subject: {
        $regex: subject,
        $options: "i",
      },
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    // Log do resultado
    if (email) {
      logger.info(`SERVICE-EMAIL - Email encontrado com ID: ${email._id}`);
    } else {
      logger.warn(
        `SERVICE-EMAIL - Nenhum email encontrado com os critérios: from=${userEmail}, to=${address}, subject=${subject}`
      );
    }

    return email;
  } catch (error) {
    logger.error(
      `SERVICE-EMAIL - Erro ao buscar email: ${(error as Error).message}`
    );
    throw error;
  }
};


/**
 * Gera um endereço de email randômico único.
 * Formato: prefixo_randomico@mockmail.dev
 *
 * @returns Endereço único gerado
 */
export const generateRandomAddress = async (): Promise<string> => {
  const generateId = () => {
    // Gera um ID curto e legível: 8 caracteres alfanuméricos
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const randomId = generateId();
    const address = `${randomId}@mockmail.dev`;

    // Verifica se já existe
    const existing = await EmailBox.findOne({ address });

    if (!existing) {
      logger.info(`SERVICE-EMAILBOX - Endereço randômico gerado: ${address}`);
      return address;
    }

    attempts++;
    logger.debug(`SERVICE-EMAILBOX - Endereço ${address} já existe, tentativa ${attempts}`);
  }

  // Fallback com timestamp para garantir unicidade
  const fallbackId = `${generateId()}${Date.now().toString(36)}`;
  const address = `${fallbackId}@mockmail.dev`;
  logger.info(`SERVICE-EMAILBOX - Endereço randômico (fallback) gerado: ${address}`);
  return address;
};

/**
 * Gera um endereço personalizado com sufixo único.
 * Formato: nome_escolhido_sufixo@mockmail.dev
 *
 * @param customName - Nome escolhido pelo usuário
 * @returns Endereço único com o nome personalizado
 */
export const generateCustomAddress = async (customName: string): Promise<string> => {
  // Sanitiza o nome: lowercase, remove caracteres especiais, max 20 chars
  const sanitizedName = customName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);

  if (!sanitizedName) {
    throw new Error("Nome personalizado inválido");
  }

  // Gera sufixo curto (4 caracteres)
  const generateSuffix = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const suffix = generateSuffix();
    const address = `${sanitizedName}_${suffix}@mockmail.dev`;

    // Verifica se já existe
    const existing = await EmailBox.findOne({ address });

    if (!existing) {
      logger.info(`SERVICE-EMAILBOX - Endereço personalizado gerado: ${address}`);
      return address;
    }

    attempts++;
    logger.debug(`SERVICE-EMAILBOX - Endereço ${address} já existe, tentativa ${attempts}`);
  }

  // Fallback com timestamp
  const fallbackSuffix = Date.now().toString(36).slice(-6);
  const address = `${sanitizedName}_${fallbackSuffix}@mockmail.dev`;
  logger.info(`SERVICE-EMAILBOX - Endereço personalizado (fallback) gerado: ${address}`);
  return address;
};

/**
 * Cria uma nova caixa de email para o usuário.
 *
 * @param userId - ID do usuário
 * @param customName - Nome personalizado (opcional, se null gera randômico)
 * @returns A caixa de email criada
 */
export const createEmailBoxForUser = async (
  userId: string,
  customName?: string
): Promise<typeof EmailBox.prototype> => {
  try {
    // Gera o endereço
    const address = customName
      ? await generateCustomAddress(customName)
      : await generateRandomAddress();

    // Calcula expiração: 24 horas
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const emailBox = new EmailBox({
      address,
      userId,
      isCustom: !!customName,
      expiresAt,
    });

    await emailBox.save();

    logger.info(
      `SERVICE-EMAILBOX - Caixa criada: ${address} | ` +
      `Tipo: ${customName ? 'personalizada' : 'randômica'} | ` +
      `Expira em: ${expiresAt.toISOString()}`
    );

    return emailBox;
  } catch (error) {
    logger.error(
      `SERVICE-EMAILBOX - Erro ao criar caixa: ${(error as Error).message}`
    );
    throw error;
  }
};

/**
 * Lista todas as caixas de email de um usuário (não expiradas).
 *
 * @param userId - ID do usuário
 * @returns Lista de caixas com tempo restante
 */
export const listUserEmailBoxes = async (userId: string) => {
  try {
    const boxes = await EmailBox.find({
      userId,
      expiresAt: { $gt: new Date() }, // Apenas não expiradas
    }).sort({ createdAt: -1 });

    // Adiciona tempo restante para cada caixa
    const boxesWithTimeLeft = boxes.map((box) => {
      const now = new Date();
      const expiresAt = new Date(box.expiresAt);
      const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
      const timeLeftSeconds = Math.floor(timeLeftMs / 1000);

      return {
        id: box._id,
        address: box.address,
        isCustom: box.isCustom,
        createdAt: box.createdAt,
        expiresAt: box.expiresAt,
        timeLeftSeconds,
        timeLeftFormatted: formatTimeLeft(timeLeftSeconds),
      };
    });

    return boxesWithTimeLeft;
  } catch (error) {
    logger.error(
      `SERVICE-EMAILBOX - Erro ao listar caixas: ${(error as Error).message}`
    );
    throw error;
  }
};

/**
 * Formata o tempo restante em formato legível.
 */
function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return "Expirada";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Deleta uma caixa de email e todos os seus emails.
 *
 * @param boxId - ID da caixa
 * @param userId - ID do usuário (para validação de propriedade)
 */
export const deleteEmailBox = async (boxId: string, userId: string) => {
  try {
    // Verifica se a caixa pertence ao usuário
    const box = await EmailBox.findOne({ _id: boxId, userId });

    if (!box) {
      throw new Error("Caixa não encontrada ou não pertence ao usuário");
    }

    // Deleta todos os emails da caixa
    const deletedEmails = await Email.deleteMany({ to: box.address });
    logger.info(
      `SERVICE-EMAILBOX - ${deletedEmails.deletedCount} emails deletados da caixa ${box.address}`
    );

    // Deleta a caixa
    await EmailBox.deleteOne({ _id: boxId });
    logger.info(`SERVICE-EMAILBOX - Caixa ${box.address} deletada`);

    return { deletedEmails: deletedEmails.deletedCount };
  } catch (error) {
    logger.error(
      `SERVICE-EMAILBOX - Erro ao deletar caixa: ${(error as Error).message}`
    );
    throw error;
  }
};
