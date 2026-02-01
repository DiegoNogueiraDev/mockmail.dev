import cron from "node-cron";
import EmailBox from "../models/EmailBox"; // Supondo que você tenha um modelo de EmailBox
import Email from "../models/Email"; // Supondo que você tenha um modelo de Email
import logger from "../utils/logger"; // Importando o logger

// Função de limpeza
export const cleanupOldEmails = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Excluir e-mails que estão há mais de 24 horas
    await Email.deleteMany({
      createdAt: {
        $lt: twentyFourHoursAgo, // E-mails criados antes de 24 horas
      },
    });

    // Excluir caixas de e-mail que estão há mais de 24 horas
    await EmailBox.deleteMany({
      createdAt: {
        $lt: twentyFourHoursAgo, // Caixas de e-mail criadas antes de 24 horas
      },
    });

    logger.info(
      "CLEANUP - Caixas de e-mail e e-mails antigos foram excluídos."
    );
  } catch (error) {
    logger.error(
      `CLEANUP - Erro ao excluir caixas de e-mail e e-mails: ${
        (error as Error).message
      }`
    );
  }
};

// Agendar a tarefa para ser executada a cada 1 hora
cron.schedule("0 * * * *", cleanupOldEmails); // Executa no início de cada hora
