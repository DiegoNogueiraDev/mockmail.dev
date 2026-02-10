import Email from "../models/Email";
import logger from "../utils/logger";

/**
 * Salva um e-mail associado a uma caixa de e-mail.
 * Verifica duplicatas pelo messageId (Message-ID do email).
 *
 * @param data - Dados do e-mail a serem salvos.
 * @returns O e-mail salvo ou o existente (se duplicado).
 */
export const saveEmail = async (data: any) => {
  try {
    logger.info(
      `SERVICE-EMAIL - Salvando e-mail de ${data.from} para ${data.to}`
    );

    // Determina o contentType baseado na presença de HTML
    const contentType = data.body?.rawHtml?.includes("<")
      ? "text/html"
      : "text/plain";

    // Mapeia data.id (Message-ID) para messageId
    const messageId = data.id || data.messageId || null;

    // Deduplicação: verificar se email com mesmo messageId já existe
    if (messageId) {
      const existing = await Email.findOne({ messageId });
      if (existing) {
        logger.warn(
          `SERVICE-EMAIL - Email duplicado detectado (messageId: ${messageId}), ignorando`
        );
        return existing;
      }
    }

    const emailData = {
      ...data,
      contentType,
      messageId,
    };
    // Remove o campo 'id' para não conflitar com o virtual do Mongoose
    delete emailData.id;

    const email = new Email(emailData);
    const savedEmail = await email.save();
    logger.info(
      `SERVICE-EMAIL - E-mail salvo com sucesso: ID ${savedEmail._id} (messageId: ${messageId})`
    );
    return savedEmail;
  } catch (error: any) {
    // Se for erro de duplicata do índice único, retorna o existente
    if (error.code === 11000 && error.keyPattern?.messageId) {
      logger.warn(
        `SERVICE-EMAIL - Duplicata capturada pelo índice único (messageId), ignorando`
      );
      const existing = await Email.findOne({ messageId: data.id || data.messageId });
      if (existing) return existing;
    }
    logger.error(
      `SERVICE-EMAIL - Erro ao salvar e-mail: ${(error as Error).message}`
    );
    throw new Error("SERVICE-EMAIL - Erro interno ao salvar e-mail");
  }
};

export const getLatestEmailFromBox = async (
  address: string,
  userEmail: string
) => {
  try {
    // Busca o email mais recente usando o email do remetente e endereço do destinatário
    const latestEmail = await Email.findOne({
      to: address, // Endereço da caixa (destinatário)
      from: userEmail, // Email do usuário (remetente)
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    if (!latestEmail) {
      logger.info(
        `SERVICE-EMAIL - Nenhum email encontrado para: ${address} de ${userEmail}`
      );
      throw new Error("Nenhum email encontrado nesta caixa");
    }

    logger.info(
      `SERVICE-EMAIL - Email mais recente recuperado para: ${address}`
    );
    return latestEmail;
  } catch (error) {
    logger.error(
      `SERVICE-EMAIL - Erro ao buscar último email: ${(error as Error).message}`
    );
    throw error;
  }
};
