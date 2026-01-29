import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import logger from "./logger";

/**
 * Processa o conteúdo do campo `body`.
 * @param rawHtml - HTML bruto do corpo do e-mail.
 * @returns Objeto com texto limpo, links e imagens extraídas.
 */
export const parseBody = (rawHtml: string) => {
  if (!rawHtml || typeof rawHtml !== "string") {
    logger.error("UTILS-BODYPARSER - HTML inválido fornecido");
    throw new Error("HTML inválido fornecido");
  }

  try {
    // Sanitizar o HTML primeiro
    const sanitizedHtml = sanitizeHtml(rawHtml, {
      allowedTags: ["a", "img", "p", "br", "b", "i", "strong", "em"],
      allowedAttributes: {
        a: ["href"],
        img: ["src", "alt"],
      },
    });

    // Carregar o HTML sanitizado no cheerio
    const $ = cheerio.load(sanitizedHtml);

    // Extrair links
    const links: string[] = [];

    // Links em tags <a>
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) links.push(href);
    });

    // Regex mais abrangente para URLs
    const urlRegex = /(?:(?:https?:\/\/)|(?:www\.))[^\s<>"\{\}\|\\\^\[\]`]+/gi;
    const textLinks = sanitizedHtml.match(urlRegex) || [];

    // Normaliza URLs começando com www.
    const normalizedLinks = textLinks.map((link) => {
      if (link.startsWith("www.")) {
        return `http://${link}`;
      }
      return link;
    });

    links.push(...normalizedLinks);

    // Remove duplicatas e links inválidos
    const uniqueLinks = [...new Set(links)].filter((link) => {
      try {
        new URL(link);
        return true;
      } catch {
        return false;
      }
    });

    // Extrair URLs de imagens
    const images: string[] = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src) images.push(src);
    });

    // Extrair texto limpo
    const plainText = $("body").text().trim() || sanitizedHtml;

    return {
      rawHtml: sanitizedHtml,
      plainText,
      links: uniqueLinks,
      images,
    };
  } catch (error) {
    logger.error(
      `UTILS-BODYPARSER - Erro ao sanitizar ou processar o HTML: ${error}`
    );
    throw new Error("Falha ao processar o corpo do e-mail.");
  }
};
