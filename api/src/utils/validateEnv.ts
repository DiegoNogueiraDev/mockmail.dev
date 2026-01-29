import dotenv from "dotenv";

dotenv.config();

const requiredVariables = ["JWT_SECRET", "MONGO_URI"];

export const validateEnv = () => {
  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]
  );

  if (missingVariables.length > 0) {
    console.error(
      `Erro: As seguintes variáveis de ambiente estão ausentes: ${missingVariables.join(
        ", "
      )}`
    );
    process.exit(1); // Finaliza o processo com erro
  }
};
