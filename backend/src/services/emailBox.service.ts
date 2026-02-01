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
export const findOrCreateEmailBox = async (address: string, userId: string) => {
  try {
    let emailBox = await EmailBox.findOne({ address, userId });

    if (!emailBox) {
      logger.info(
        `SERVICE-EMAILBOX - Criando nova caixa de e-mail para o usuário ${userId} com endereço: ${address}`
      );
      emailBox = new EmailBox({
        address,
        userId,
      });
      await emailBox.save();
    } else {
      logger.info(
        `SERVICE-EMAILBOX - Caixa de e-mail encontrada para o usuário ${userId}: ${address}`
      );
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
