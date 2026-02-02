import Joi from "joi";
import { extractEmail, isValidEmail } from "../utils/emailParser";

// Limites de segurança (RFC 2822 + boas práticas)
const EMAIL_LIMITS = {
  SUBJECT_MAX: 998,      // RFC 2822 linha máxima
  BODY_MAX: 5 * 1024 * 1024,  // 5MB máximo para corpo
  EMAIL_ADDRESS_MAX: 254, // RFC 5321
  MESSAGE_ID_MAX: 500,
} as const;

// Validação com limites de segurança
export const emailSchema = Joi.object({
  from: Joi.string()
    .custom((value, helpers) => {
      try {
        // Verificar tamanho máximo para campos de email (RFC 5321)
        if (value.length > EMAIL_LIMITS.EMAIL_ADDRESS_MAX) {
          return helpers.error("string.max");
        }

        // Extrair e verificar formato básico
        const email = extractEmail(value);
        if (!isValidEmail(email)) {
          return helpers.error("string.email");
        }

        // Verificar se há tags script/html perigosas
        const dangerousPatterns = /<script|<\/script|javascript:/i;
        if (dangerousPatterns.test(value)) {
          return helpers.error("string.invalid");
        }

        return value;
      } catch (error) {
        return helpers.error("string.email");
      }
    })
    .required()
    .messages({
      'string.email': 'Campo "from" deve conter um email válido',
      'string.max': 'Campo "from" não pode ter mais de 254 caracteres',
      'string.invalid': 'Campo "from" contém código malicioso',
      'any.required': 'Campo "from" é obrigatório'
    }),

  to: Joi.string()
    .custom((value, helpers) => {
      try {
        // Verificar tamanho máximo para campos de email (RFC 5321)
        if (value.length > EMAIL_LIMITS.EMAIL_ADDRESS_MAX) {
          return helpers.error("string.max");
        }

        // Extrair e verificar formato básico
        const email = extractEmail(value);
        if (!isValidEmail(email)) {
          return helpers.error("string.email");
        }

        // Verificar se há tags script/html perigosas
        const dangerousPatterns = /<script|<\/script|javascript:/i;
        if (dangerousPatterns.test(value)) {
          return helpers.error("string.invalid");
        }

        return value;
      } catch (error) {
        return helpers.error("string.email");
      }
    })
    .required()
    .messages({
      'string.email': 'Campo "to" deve conter um email válido',
      'string.max': 'Campo "to" não pode ter mais de 254 caracteres',
      'string.invalid': 'Campo "to" contém código malicioso',
      'any.required': 'Campo "to" é obrigatório'
    }),

  subject: Joi.string()
    .min(1)
    .max(EMAIL_LIMITS.SUBJECT_MAX) // RFC 2822: max 998 chars por linha
    .pattern(/^(?!.*<script).*$/i) // Não permitir tags script
    .required()
    .messages({
      'string.min': 'Assunto deve ter no mínimo 1 caractere',
      'string.max': `Assunto não pode ter mais de ${EMAIL_LIMITS.SUBJECT_MAX} caracteres`,
      'string.pattern.base': 'Assunto contém código malicioso',
      'any.required': 'Assunto é obrigatório'
    }),

  body: Joi.string()
    .min(1)
    .max(EMAIL_LIMITS.BODY_MAX) // 5MB máximo para evitar DoS
    .required()
    .messages({
      'string.min': 'Corpo do email deve ter no mínimo 1 caractere',
      'string.max': 'Corpo do email excede o tamanho máximo permitido (5MB)',
      'any.required': 'Corpo do email é obrigatório'
    }),
    
  // Validação customizada para Message-ID
  id: Joi.string()
    .custom((value, helpers) => {
      // Aceita string vazia
      if (!value || value.trim() === '') {
        return value;
      }

      const trimmedValue = value.trim();

      // Verifica tamanho máximo
      if (trimmedValue.length > EMAIL_LIMITS.MESSAGE_ID_MAX) {
        return helpers.error("string.max");
      }

      // Rejeita padrões perigosos
      const dangerousPatterns = /<script|<\/script|javascript:|eval\(|function\(/i;
      if (dangerousPatterns.test(value)) {
        return helpers.error("string.dangerous");
      }

      // Verifica se contém caracteres válidos para Message-ID
      const hasValidChars = /[a-zA-Z0-9@.<>_-]/.test(trimmedValue);
      if (!hasValidChars) {
        return helpers.error("string.invalid");
      }

      return value;
    })
    .optional()
    .messages({
      'string.max': `ID não pode ter mais de ${EMAIL_LIMITS.MESSAGE_ID_MAX} caracteres`,
      'string.dangerous': 'ID contém código potencialmente perigoso',
      'string.invalid': 'ID deve conter caracteres válidos para Message-ID'
    }),
    
  date: Joi.alternatives()
    .try(
      Joi.date().max('now'),
      Joi.string() // Permitir string para formatos de data de email
    )
    .optional()
    .messages({
      'date.max': 'Data não pode ser no futuro'
    }),
    
  content_type: Joi.string()
    .valid('text/plain', 'text/html', 'multipart/mixed', 'multipart/alternative')
    .optional()
    .messages({
      'any.only': 'Tipo de conteúdo deve ser um dos valores permitidos'
    }),
    
  processed_at: Joi.date()
    .optional()
});
