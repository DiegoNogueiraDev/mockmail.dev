/**
 * Extrai o endereço de email de diferentes formatos e garante que a saída
 * seja sempre apenas o email, removendo qualquer texto adicional
 *
 * @param input - String que pode conter um email em qualquer formato
 * @returns - Apenas o email limpo
 */
export const extractEmail = (input: string): string => {
  // Remove aspas escapadas e espaços extras
  const cleanInput = input.replace(/\\"/g, '"').trim();

  // CORREÇÃO: Regex mais robusta para suportar formatos complexos como:
  // - "Nome (Cargo)" <email@domain.com>
  // - Nome <email@domain.com>
  // - email@domain.com
  // - "Nome : Sobrenome" <email@domain.com>
  // - preprodtlffenix.q3.3055@mockmail.dev (usernames com números e múltiplos pontos)
  const emailRegex = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const match = cleanInput.match(emailRegex);

  if (!match) {
    throw new Error(`Formato de email inválido: ${input}`);
  }

  return match[0]; // Retorna apenas o email encontrado
};

/**
 * Valida se o email está em um formato válido
 * CORREÇÃO: Suporta usernames mais complexos com números e múltiplos pontos
 */
export const isValidEmail = (email: string): boolean => {
  // Regex mais permissiva para usernames, mantendo padrão RFC 5322
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  // Validações adicionais
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // Não deve começar ou terminar com ponto no username
  const [username, domain] = email.split('@');
  if (username.startsWith('.') || username.endsWith('.')) {
    return false;
  }
  
  // Não deve ter pontos consecutivos no username
  if (username.includes('..')) {
    return false;
  }
  
  // Domain não deve começar ou terminar com hífen
  if (domain.startsWith('-') || domain.endsWith('-')) {
    return false;
  }
  
  return true;
};

/**
 * Nova função: Extrai email de formatos mais complexos com melhor logging
 */
export const extractEmailWithLogging = (input: string): { email: string; originalFormat: string } => {
  const cleanInput = input.replace(/\\"/g, '"').trim();
  
  // Detectar formato do input
  let format = 'unknown';
  if (cleanInput.includes('<') && cleanInput.includes('>')) {
    format = 'display-name <email>';
  } else if (cleanInput.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
    format = 'plain-email';
  }
  
  const email = extractEmail(cleanInput);
  
  return {
    email,
    originalFormat: format
  };
};


/**
 * Extrai token do assunto do email
 * Procura por padrão "Token: XXXXXX" no assunto
 *
 * @param subject - Assunto do email
 * @returns - Token extraído ou assunto original se não encontrar
 */
export const extractTokenSubject = (subject: string): string => {
  const match = subject.match(/Token:\s*([A-Z0-9]+)/i);
  if (!match) {
    return subject; // Retorna o subject original se não encontrar o padrão
  }
  return match[1]; // Retorna apenas o token (ex: QRGSNX)
};
