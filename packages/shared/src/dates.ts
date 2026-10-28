/**
 * Datas de calendário sem fuso horário.
 *
 * Lançamentos financeiros são datas puras ("dia 10"), não instantes.
 * Trabalhar com strings `YYYY-MM-DD` e aritmética inteira evita o clássico
 * bug de `new Date('2026-11-10')` virar dia 9 no fuso de São Paulo.
 */

/** Data no formato `YYYY-MM-DD`. */
export type IsoDate = string;

/** Mês de referência no formato `YYYY-MM`. */
export type YearMonth = string;

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

export function parseIsoDate(value: IsoDate): DateParts {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`Data inválida: "${value}" (esperado YYYY-MM-DD)`);
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > daysInMonth(parts.year, parts.month)
  ) {
    throw new Error(`Data inválida: "${value}"`);
  }
  return parts;
}

export function isValidIsoDate(value: string): boolean {
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

export function formatIsoDate({ year, month, day }: DateParts): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYearMonth(value: YearMonth): { year: number; month: number } {
  const match = YEAR_MONTH.exec(value);
  if (!match) throw new Error(`Mês inválido: "${value}" (esperado YYYY-MM)`);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Mês inválido: "${value}"`);
  return { year: Number(match[1]), month };
}

export function formatYearMonth(year: number, month: number): YearMonth {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  // Dia 0 do mês seguinte = último dia do mês atual. UTC evita horário de verão.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Soma (ou subtrai) meses a um par ano/mês. */
export function addMonths(
  year: number,
  month: number,
  amount: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + amount;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * Monta uma data limitando o dia ao último dia do mês.
 * Ex.: dia 31 em fevereiro de 2027 vira 2027-02-28.
 */
export function clampedDate(year: number, month: number, day: number): IsoDate {
  return formatIsoDate({ year, month, day: Math.min(day, daysInMonth(year, month)) });
}

/** Compara duas datas ISO (a ordem lexicográfica coincide com a cronológica). */
export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Data de hoje no fuso informado (padrão: São Paulo). */
export function todayIso(timeZone = 'America/Sao_Paulo', now: Date = new Date()): IsoDate {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
