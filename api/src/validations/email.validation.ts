import Joi from "joi";
import { extractEmail, isValidEmail } from "../utils/emailParser";

// Validação SEM LIMITES DE TAMANHO (como o Python)
export const emailSchema = Joi.object({
  from: Joi.string()
    .custom((value, helpers) => {
      try {
        // Verificar tamanho máximo apenas para campos de email (RFC)
        if (value.length > 254) {
          return helpers.error("string.max");
        }
        
        // Extrair e verificar formato básico
        const email = extractEmail(value);
        if (!isValidEmail(email)) {
          return helpers.error("string.email");
        }
        
        // CORREÇÃO: Verificar apenas se há tags script/html perigosas
        // Permitimos < > quando fazem parte do formato de email válido
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
        // Verificar tamanho máximo apenas para campos de email (RFC)
        if (value.length > 254) {
          return helpers.error("string.max");
        }
        
        // Extrair e verificar formato básico
        const email = extractEmail(value);
        if (!isValidEmail(email)) {
          return helpers.error("string.email");
        }
        
        // CORREÇÃO: Verificar apenas se há tags script/html perigosas
        // Permitimos < > quando fazem parte do formato de email válido
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
    // SEM LIMITE DE TAMANHO NO SUBJECT
    .pattern(/^(?!.*<script).*$/i) // Não permitir tags script
    .required()
    .messages({
      'string.min': 'Assunto deve ter no mínimo 1 caractere',
      'string.pattern.base': 'Assunto contém código malicioso',
      'any.required': 'Assunto é obrigatório'
    }),
    
  body: Joi.string()
    .min(1)
    // SEM LIMITE DE TAMANHO NO BODY (como o Python)
    .required()
    .messages({
      'string.min': 'Corpo do email deve ter no mínimo 1 caractere',
      'any.required': 'Corpo do email é obrigatório'
    }),
    
  // CORRIGIDO: Validação customizada mais flexível para Message-ID
  id: Joi.string()
    .custom((value, helpers) => {
      // Aceita string vazia
      if (!value || value.trim() === '') {
        return value;
      }
      
      // Trimma espaços em branco do início e fim
      const trimmedValue = value.trim();
      
      // Verifica tamanho máximo
      if (trimmedValue.length > 500) {
        return helpers.error("string.max");
      }
      
      // Validação mais flexível para Message-ID
      // Permite caracteres comuns em Message-IDs reais: letras, números, @, ., <, >, _, -, espaços, /
      // Mas rejeita caracteres perigosos como scripts
      const dangerousPatterns = /<script|<\/script|javascript:|eval\(|function\(/i;
      if (dangerousPatterns.test(value)) {
        return helpers.error("string.dangerous");
      }
      
      // Verifica se contém pelo menos alguns caracteres válidos de Message-ID
      // Não precisa ser super restritivo, já que é apenas um identificador
      const hasValidChars = /[a-zA-Z0-9@.<>_-]/.test(trimmedValue);
      if (!hasValidChars) {
        return helpers.error("string.invalid");
      }
      
      return value; // Retorna o valor original (com espaços se houver)
    })
    .optional()
    .messages({
      'string.max': 'ID não pode ter mais de 500 caracteres',
      'string.dangerous': 'ID contém código potencialmente perigoso',
      'string.invalid': 'ID deve conter pelo menos alguns caracteres válidos para Message-ID'
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
