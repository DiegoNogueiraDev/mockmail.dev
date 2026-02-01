/**
 * Utilitário para formatação de datas com timezone brasileiro (UTC-3)
 */

/**
 * Formata uma data/string para o formato brasileiro com timezone UTC-3
 * @param dateInput - String de data, Date object, ou timestamp
 * @param options - Opções de formatação
 * @returns String formatada no timezone brasileiro
 */
export function formatToBrazilianTime(
  dateInput: string | Date | number,
  options: {
    includeTime?: boolean;
    includeSeconds?: boolean;
    shortFormat?: boolean;
  } = {}
): string {
  const { includeTime = true, includeSeconds = false, shortFormat = false } = options;

  try {
    let date: Date;

    if (typeof dateInput === 'string') {
      // Trata diferentes formatos de string
      if (dateInput.includes('T')) {
        date = new Date(dateInput);
      } else if (dateInput.includes(' ')) {
        // Formato "YYYY-MM-DD HH:MM:SS"
        date = new Date(dateInput.replace(' ', 'T'));
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }

    // Verifica se a data é válida
    if (isNaN(date.getTime())) {
      console.warn('Data inválida fornecida:', dateInput);
      return typeof dateInput === 'string' ? dateInput : 'Data inválida';
    }

    // Configurações para timezone brasileiro
    const brazilianTimeZone = 'America/Sao_Paulo';
    
    let formatOptions: Intl.DateTimeFormatOptions;

    if (shortFormat) {
      formatOptions = {
        timeZone: brazilianTimeZone,
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        ...(includeTime && {
          hour: '2-digit',
          minute: '2-digit',
          ...(includeSeconds && { second: '2-digit' }),
          hour12: false
        })
      };
    } else {
      formatOptions = {
        timeZone: brazilianTimeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(includeTime && {
          hour: '2-digit',
          minute: '2-digit',
          ...(includeSeconds && { second: '2-digit' }),
          hour12: false
        })
      };
    }

    return date.toLocaleString('pt-BR', formatOptions);
  } catch (error) {
    console.error('Erro ao formatar data:', error, 'Input:', dateInput);
    return typeof dateInput === 'string' ? dateInput : 'Erro na data';
  }
}

/**
 * Formata timestamp para exibição relativa (ex: "há 5 minutos")
 * @param dateInput - String de data, Date object, ou timestamp
 * @returns String com tempo relativo em português
 */
export function formatRelativeTime(dateInput: string | Date | number): string {
  try {
    let date: Date;

    if (typeof dateInput === 'string') {
      if (dateInput.includes('T')) {
        date = new Date(dateInput);
      } else if (dateInput.includes(' ')) {
        date = new Date(dateInput.replace(' ', 'T'));
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }

    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'agora mesmo';
    } else if (diffMinutes < 60) {
      return `há ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffHours < 24) {
      return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffDays < 7) {
      return `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    } else {
      // Para períodos maiores, retorna a data formatada
      return formatToBrazilianTime(date, { includeTime: false });
    }
  } catch (error) {
    console.error('Erro ao calcular tempo relativo:', error);
    return 'Data inválida';
  }
}

/**
 * Formata data apenas (sem horário) no formato brasileiro
 * @param dateInput - String de data, Date object, ou timestamp
 * @returns String formatada (dd/mm/aaaa)
 */
export function formatDateOnly(dateInput: string | Date | number): string {
  return formatToBrazilianTime(dateInput, { includeTime: false });
}

/**
 * Formata horário apenas no formato brasileiro (24h)
 * @param dateInput - String de data, Date object, ou timestamp
 * @param includeSeconds - Se deve incluir segundos
 * @returns String formatada (HH:MM ou HH:MM:SS)
 */
export function formatTimeOnly(dateInput: string | Date | number, includeSeconds = false): string {
  try {
    let date: Date;

    if (typeof dateInput === 'string') {
      if (dateInput.includes('T')) {
        date = new Date(dateInput);
      } else if (dateInput.includes(' ')) {
        date = new Date(dateInput.replace(' ', 'T'));
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }

    if (isNaN(date.getTime())) {
      return 'Horário inválido';
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds && { second: '2-digit' }),
      hour12: false
    };

    return date.toLocaleTimeString('pt-BR', formatOptions);
  } catch (error) {
    console.error('Erro ao formatar horário:', error);
    return 'Horário inválido';
  }
}

/**
 * Converte data para timezone brasileiro mantendo o objeto Date
 * @param dateInput - String de data, Date object, ou timestamp
 * @returns Date object ajustado para timezone brasileiro
 */
export function toBrazilianDate(dateInput: string | Date | number): Date {
  try {
    let date: Date;

    if (typeof dateInput === 'string') {
      if (dateInput.includes('T')) {
        date = new Date(dateInput);
      } else if (dateInput.includes(' ')) {
        date = new Date(dateInput.replace(' ', 'T'));
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }

    if (isNaN(date.getTime())) {
      throw new Error('Data inválida');
    }

    return date;
  } catch (error) {
    console.error('Erro ao converter data:', error);
    return new Date(); // Fallback para data atual
  }
}
