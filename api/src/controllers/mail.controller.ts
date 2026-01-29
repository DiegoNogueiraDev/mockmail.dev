import { Request, Response } from "express";
import { findUserByEmail, generateToken } from "../services/user.service";
import {
  findOrCreateEmailBox,
  getLatestEmailBySubjectService,
} from "../services/emailBox.service";
import { saveEmail } from "../services/email.service";
import logger from "../utils/logger";
import { parseBody } from "../utils/bodyParser";
import { getLatestEmailFromBox } from "../services/email.service";
import { extractEmail as extractEmailUtil } from "../utils/emailParser";

// Function to extract email from `from` field
const extractEmail = (rawFrom: string): string => {
  try {
    return extractEmailUtil(rawFrom);
  } catch (error) {
    logger.warn(`UTILS-EXTRACT - Failed to extract email from: ${rawFrom}`);
    throw new Error("Invalid email format in 'from' field");
  }
};

// Function to extract token from subject
const extractTokenSubject = (subject: string): string => {
  const match = subject.match(/Token:\s*([A-Z0-9]+)/i);
  if (!match) {
    logger.warn(
      `UTILS-EXTRACT - Falha ao extrair token do assunto: ${subject}`
    );
    return subject; // Retorna o subject original se não encontrar o padrão
  }
  return match[1]; // Retorna apenas o token (QRGSNX)
};

/**
 * Controller to process incoming emails.
 */
export const processMail = async (req: Request, res: Response) => {
  logger.info("CONTROL-MAIL - Request received:", req.body);

  try {
    // Destructure and validate payload
    const {
      from: rawFrom,
      to,
      subject,
      body: rawHtml,
      id,
      date,
      content_type,
      processed_at,
    } = req.body;

    if (
      !rawFrom ||
      !to ||
      !subject ||
      typeof rawHtml !== "string" ||
      rawHtml.trim() === ""
    ) {
      logger.warn(
        "CONTROL-MAIL - Missing or invalid required fields in payload."
      );
      return res.status(400).json({
        message: "Missing or invalid required fields in payload.",
      });
    }

    // Extract and validate email
    let from: string;
    try {
      from = extractEmail(rawFrom);
    } catch (error) {
      logger.warn(`CONTROL-MAIL - Invalid 'from' field: ${rawFrom}`);
      return res.status(400).json({
        message: "Invalid 'from' field.",
      });
    }

    // Find user by email
    let user;
    try {
      user = await findUserByEmail(from);
    } catch (error) {
      logger.error(
        `SERVICE-USER - Error while finding user: ${(error as Error).message}`
      );
      throw new Error("Internal server error while validating user.");
    }

    if (!user) {
      logger.warn(`CONTROL-MAIL - User not found for email: ${from}`);
      return res.status(401).json({
        message:
          "User not found. Please register, log in, and provide a valid token.",
      });
    }

    // Validar e processar o corpo do e-mail
    let parsedBody;
    try {
      if (typeof rawHtml !== "string" || rawHtml.trim() === "") {
        logger.warn("CONTROL-MAIL - Campo 'body' inválido ou vazio.");
        return res.status(400).json({
          message: "CONTROL-MAIL - Campo 'body' inválido ou vazio.",
        });
      }

      parsedBody = parseBody(rawHtml);
    } catch (error) {
      logger.error(
        `UTILS-BODYPARSER - Error parsing email body: ${
          (error as Error).message
        }`
      );
      return res.status(400).json({
        message: "CONTROL-MAIL - Falha ao processar o corpo do e-mail.",
      });
    }

    // Associate or create email box
    let emailBox;
    try {
      emailBox = await findOrCreateEmailBox(to, user.id);
    } catch (error) {
      logger.error(
        `SERVICE-EMAILBOX - Error creating or finding email box: ${
          (error as Error).message
        }`
      );
      throw new Error("Internal server error while processing email box.");
    }

    // Generate token
    const token = extractTokenSubject(subject);

    // Save email
    let email;

    try {
      email = await saveEmail({
        from,
        to,
        subject,
        body: {
          rawHtml: parsedBody.rawHtml,
          plainText: parsedBody.plainText,
          metadata: { links: parsedBody.links, images: parsedBody.images },
        },
        id,
        date,
        token,
        content_type,
        processed_at,
        emailBox: emailBox.id,
      });
    } catch (error) {
      logger.error(
        `SERVICE-EMAIL - Error saving email: ${(error as Error).message}`
      );
      throw new Error("Internal server error while saving email.");
    }

    logger.info(
      `CONTROL-MAIL - Email processed successfully for user ${user.id}`
    );
    return res
      .status(201)
      .json({ message: "Email processed successfully", email });
  } catch (error) {
    logger.error(
      `CONTROL-MAIL - Unexpected error: ${(error as Error).message}`
    );
    return res.status(500).json({
      message: "Internal server error while processing the email.",
    });
  }
};

export const getLatestEmail = async (req: Request, res: Response) => {
  const { address } = req.params;
  const { from } = req.query;

  try {
    if (!from) {
      logger.warn('CONTROL-MAIL - Campo "from" não fornecido');
      return res.status(400).json({ message: 'Campo "from" é obrigatório' });
    }

    // Busca o email mais recente usando o service
    const latestEmail = await getLatestEmailFromBox(address, from as string);

    return res.status(200).json({ email: latestEmail });
  } catch (error) {
    const errorMessage = (error as Error).message;

    if (
      errorMessage.includes("não encontrada") ||
      errorMessage.includes("Nenhum email")
    ) {
      return res.status(404).json({ message: errorMessage });
    }

    logger.error(`CONTROL-MAIL - Erro ao buscar último email: ${errorMessage}`);
    return res.status(500).json({ message: "Erro ao buscar último email" });
  }
};

// Função para obter o e-mail mais novo por assunto
export const getLatestEmailBySubject = async (req: Request, res: Response) => {
  const { address, subject } = req.params;
  const userEmail = req.query.from as string; // Capturando o e-mail do remetente a partir da query

  logger.info(
    `CONTROL-MAIL - Buscando e-mail mais recente por assunto: ${subject} para o usuário: ${userEmail} e endereço: ${address}`
  );

  if (!userEmail) {
    return res
      .status(400)
      .json({ message: "O parâmetro 'from' é obrigatório." });
  }

  try {
    const emailSubject = await getLatestEmailBySubjectService(
      userEmail,
      address,
      subject
    );
    if (!emailSubject) {
      logger.warn(
        `CONTROL-MAIL - E-mail não encontrado para o assunto: ${subject}`
      );
      return res.status(404).json({ message: "E-mail não encontrado." });
    }
    return res.status(200).json({ email: emailSubject });
  } catch (error) {
    logger.error(
      `MAIL-ROUTE - Erro ao obter e-mail por assunto: ${
        (error as Error).message
      }`
    );
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * Controller to get email boxes statistics by user.
 */

/**
 * Controller to get email boxes statistics by user.
 */
export const getEmailBoxesByUser = async (req: Request, res: Response) => {
  try {
    logger.info("CONTROL-MAIL - Fetching email boxes statistics by user");

    // Agregação para obter estatísticas das caixas por usuário
    const pipeline = [
      {
        $lookup: {
          from: "users", // Nome da coleção de usuários
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: "$user"
      },
      {
        $group: {
          _id: "$user.email",
          userName: { $first: "$user.name" },
          userId: { $first: "$user._id" },
          totalBoxes: { $sum: 1 },
          boxes: {
            $push: {
              address: "$address",
              createdAt: "$createdAt",
              updatedAt: "$updatedAt"
            }
          }
        }
      },
      {
        $sort: { totalBoxes: -1 } // Ordenar por número de caixas (decrescente)
      }
    ];

    const EmailBox = require("../models/EmailBox").default;
    const result: any[] = await EmailBox.aggregate(pipeline);

    // Calcular estatísticas gerais
    const totalUsers = result.length;
    const totalBoxes = result.reduce((sum: number, user: any) => sum + user.totalBoxes, 0);
    const averageBoxesPerUser = totalUsers > 0 ? parseFloat((totalBoxes / totalUsers).toFixed(2)) : 0;

    const response = {
      summary: {
        totalUsers,
        totalBoxes,
        averageBoxesPerUser
      },
      users: result.map((user: any) => ({
        email: user._id,
        name: user.userName,
        userId: user.userId,
        totalBoxes: user.totalBoxes,
        boxes: user.boxes
      }))
    };

    logger.info(`CONTROL-MAIL - Email boxes statistics fetched successfully: ${totalUsers} users, ${totalBoxes} boxes`);
    return res.status(200).json(response);
  } catch (error) {
    logger.error(
      `CONTROL-MAIL - Error fetching email boxes statistics: ${(error as Error).message}`
    );
    return res.status(500).json({
      message: "Internal server error while fetching email boxes statistics.",
    });
  }
};
