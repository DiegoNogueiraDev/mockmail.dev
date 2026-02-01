import Email from "../models/Email";
import logger from "../utils/logger";

/**
 * Salva um e-mail associado a uma caixa de e-mail.
 *
 * @param data - Dados do e-mail a serem salvos.
 * @returns O e-mail salvo.
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

    const emailData = {
      ...data,
      contentType, // Adiciona o contentType determinado automaticamente
    };

    const email = new Email(emailData);
    const savedEmail = await email.save();
    logger.info(
      `SERVICE-EMAIL - E-mail salvo com sucesso: ID ${savedEmail.id}`
    );
    return savedEmail;
  } catch (error) {
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
