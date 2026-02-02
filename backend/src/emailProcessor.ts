/**
 * MockMail.dev - Email Processor / Distributor (Standalone)
 *
 * Este é o ÚNICO processo que lê da FIFO do Postfix.
 * Distribui emails para as APIs de cada ambiente (HML/PROD) via HTTP.
 *
 * Fluxo:
 *   Postfix → email-handler.sh → FIFO → emailProcessor.ts (ÚNICO)
 *                                              ↓
 *                                   Analisa domínio TO
 *                                     ↙           ↘
 *                            API HML (:3010)   API PROD (:3000)
 *                            POST /internal    POST /internal
 *                            /process-email    /process-email
 *                                  ↓                 ↓
 *                            MongoDB HML      MongoDB PROD
 *
 * IMPORTANTE: Este processo deve rodar apenas UMA vez no servidor,
 * independente de quantos ambientes estejam ativos.
 */
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import http from "http";

// Carrega variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// Configurações via variáveis de ambiente
const FIFO_PATH = process.env.MOCKMAIL_FIFO_PATH || "/var/spool/email-processor";
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || "mockmail-internal-2026";
const DEBUG_MODE = process.env.MOCKMAIL_DEBUG === "true";
const LOG_DIR = "/var/log/mockmail";

// Configuração dos ambientes
interface EnvironmentConfig {
  name: string;
  apiPort: number;
  domains: string[];
  enabled: boolean;
}

// Configuração padrão dos ambientes
// Pode ser sobrescrita via variáveis de ambiente
const ENVIRONMENTS: EnvironmentConfig[] = [
  {
    name: "homologacao",
    apiPort: parseInt(process.env.HML_API_PORT || "3010", 10),
    domains: ["homologacao.mockmail.dev", "hml.mockmail.dev"],
    enabled: process.env.HML_ENABLED !== "false",
  },
  {
    name: "producao",
    apiPort: parseInt(process.env.PROD_API_PORT || "3000", 10),
    domains: ["mockmail.dev"],
    enabled: process.env.PROD_ENABLED !== "false",
  },
];

// Logger simples (não depende de winston para manter standalone)
const log = {
  info: (msg: string) => console.log(`[${new Date().toISOString()}] [INFO] EMAIL-PROCESSOR - ${msg}`),
  warn: (msg: string) => console.log(`[${new Date().toISOString()}] [WARN] EMAIL-PROCESSOR - ${msg}`),
  error: (msg: string) => console.error(`[${new Date().toISOString()}] [ERROR] EMAIL-PROCESSOR - ${msg}`),
  debug: (msg: string) => DEBUG_MODE && console.log(`[${new Date().toISOString()}] [DEBUG] EMAIL-PROCESSOR - ${msg}`),
};

/**
 * Extrai o endereço de email do campo TO do email raw
 */
function extractToAddress(rawEmail: string): string | null {
  // Procura por "To: " no header do email
  const toMatch = rawEmail.match(/^To:\s*(.+)$/im);
  if (!toMatch) return null;

  let toValue = toMatch[1].trim();

  // Extrai email se estiver no formato "Nome <email@domain>"
  const emailMatch = toValue.match(/<([^>]+)>/);
  if (emailMatch) {
    return emailMatch[1].toLowerCase();
  }

  // Ou é só o email direto
  if (toValue.includes("@")) {
    return toValue.toLowerCase();
  }

  return null;
}

/**
 * Determina para qual ambiente o email deve ir baseado no domínio TO
 */
function determineEnvironment(toAddress: string): EnvironmentConfig | null {
  const domain = toAddress.split("@")[1];
  if (!domain) return null;

  // Primeiro verifica HML (domínios mais específicos têm prioridade)
  for (const env of ENVIRONMENTS) {
    if (!env.enabled) continue;

    // Verifica se o domínio corresponde exatamente ou é subdomínio
    if (env.domains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return env;
    }
  }

  // Fallback para produção se for mockmail.dev genérico
  if (domain.endsWith("mockmail.dev")) {
    const prodEnv = ENVIRONMENTS.find((e) => e.name === "producao" && e.enabled);
    if (prodEnv) return prodEnv;
  }

  return null;
}

/**
 * Envia email para a API do ambiente via HTTP
 */
async function sendToApi(rawEmail: string, env: EnvironmentConfig): Promise<boolean> {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ rawEmail });

    const options: http.RequestOptions = {
      hostname: "localhost",
      port: env.apiPort,
      path: "/api/internal/process-email",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "X-Internal-Token": INTERNAL_TOKEN,
      },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          log.info(`Email enviado para ${env.name} (porta ${env.apiPort}) com sucesso`);
          resolve(true);
        } else {
          log.error(`API ${env.name} retornou ${res.statusCode}: ${data}`);
          resolve(false);
        }
      });
    });

    req.on("error", (error) => {
      log.error(`Erro ao conectar com API ${env.name} (porta ${env.apiPort}): ${error.message}`);
      resolve(false);
    });

    req.on("timeout", () => {
      log.error(`Timeout ao conectar com API ${env.name}`);
      req.destroy();
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Salva emails que falharam para processamento posterior
 */
function saveFailedEmail(rawEmail: string, reason: string): void {
  const failedDir = `${LOG_DIR}/failed`;
  try {
    if (!fs.existsSync(failedDir)) {
      fs.mkdirSync(failedDir, { recursive: true });
    }

    const filename = `${Date.now()}-${reason}.eml`;
    fs.writeFileSync(path.join(failedDir, filename), rawEmail);
    log.info(`Email salvo em ${failedDir}/${filename}`);
  } catch (error) {
    log.error(`Erro ao salvar email falho: ${(error as Error).message}`);
  }
}

/**
 * Processa um email: determina ambiente e envia
 */
async function processEmail(rawEmail: string): Promise<void> {
  const toAddress = extractToAddress(rawEmail);

  if (!toAddress) {
    log.warn("Não foi possível extrair endereço TO do email");
    saveFailedEmail(rawEmail, "no-to-address");
    return;
  }

  log.info(`Email para: ${toAddress}`);

  const env = determineEnvironment(toAddress);

  if (!env) {
    log.warn(`Domínio não reconhecido para: ${toAddress}`);
    saveFailedEmail(rawEmail, "unknown-domain");
    return;
  }

  log.info(`Encaminhando para ambiente: ${env.name} (porta ${env.apiPort})`);

  const success = await sendToApi(rawEmail, env);

  if (!success) {
    log.error(`Falha ao enviar para ${env.name}, salvando para retry`);
    saveFailedEmail(rawEmail, `api-error-${env.name}`);
  }
}

/**
 * Lê emails do FIFO de forma contínua
 */
async function readFromFifoContinuous(): Promise<void> {
  log.info(`Abrindo FIFO: ${FIFO_PATH}`);

  if (!fs.existsSync(FIFO_PATH)) {
    log.error(`FIFO não existe: ${FIFO_PATH}`);
    throw new Error(`FIFO not found: ${FIFO_PATH}`);
  }

  const stream = fs.createReadStream(FIFO_PATH, { encoding: "utf-8" });
  let buffer = "";

  stream.on("data", async (chunk: Buffer | string) => {
    const data = chunk.toString();
    log.debug(`Recebidos ${data.length} bytes`);

    buffer += data;

    // Processa emails quando encontra separador (três quebras de linha)
    const parts = buffer.split(/\n\n\n/);

    if (parts.length > 1) {
      for (let i = 0; i < parts.length - 1; i++) {
        const emailRaw = parts[i].trim();
        if (emailRaw) {
          try {
            log.info(`Processando email (${emailRaw.length} bytes)`);
            await processEmail(emailRaw);
          } catch (error) {
            log.error(`Erro ao processar: ${(error as Error).message}`);
          }
        }
      }
      buffer = parts[parts.length - 1];
    }
  });

  stream.on("end", async () => {
    // Processa email pendente no buffer antes de reabrir
    if (buffer.trim()) {
      try {
        log.info(`Processando email pendente (${buffer.length} bytes)`);
        await processEmail(buffer);
        buffer = "";
      } catch (error) {
        log.error(`Erro ao processar: ${(error as Error).message}`);
      }
    }
    log.warn("Stream encerrado, reabrindo FIFO...");
    setTimeout(() => readFromFifoContinuous(), 1000);
  });

  stream.on("error", (error) => {
    log.error(`Erro no stream FIFO: ${error.message}`);
    setTimeout(() => readFromFifoContinuous(), 2000);
  });

  log.info("FIFO aberto, aguardando emails...");
}

/**
 * Main
 */
async function main(): Promise<void> {
  console.log("═".repeat(60));
  console.log("EMAIL-PROCESSOR - MockMail.dev Email Processor/Distributor");
  console.log("═".repeat(60));
  console.log(`Modo: DISTRIBUIDOR ÚNICO (lê FIFO e encaminha para APIs)`);
  console.log(`FIFO: ${FIFO_PATH}`);
  console.log(`Debug: ${DEBUG_MODE}`);
  console.log("");
  console.log("Ambientes configurados:");
  ENVIRONMENTS.forEach((env) => {
    const status = env.enabled ? "✓ ATIVO" : "✗ INATIVO";
    console.log(`  ${status} ${env.name}: porta ${env.apiPort}, domínios: ${env.domains.join(", ")}`);
  });
  console.log("");
  console.log(`Token interno: ${INTERNAL_TOKEN.substring(0, 15)}...`);
  console.log("═".repeat(60));

  // Verifica se pelo menos um ambiente está habilitado
  const enabledEnvs = ENVIRONMENTS.filter((e) => e.enabled);
  if (enabledEnvs.length === 0) {
    log.error("Nenhum ambiente habilitado! Configure HML_ENABLED ou PROD_ENABLED");
    process.exit(1);
  }

  await readFromFifoContinuous();
}

// Tratamento de sinais para graceful shutdown
process.on("SIGINT", () => {
  log.info("Recebido SIGINT, encerrando...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  log.info("Recebido SIGTERM, encerrando...");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  log.error(`Uncaught Exception: ${error.message}`);
  log.error(error.stack || "");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Inicia
main();
