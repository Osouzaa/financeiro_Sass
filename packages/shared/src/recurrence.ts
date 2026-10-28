import { addDays, addMonths, clampedDate, parseIsoDate, type IsoDate } from './dates';
import { RecurrenceFrequency } from './enums';
import type { Cents } from './money';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  startDate: IsoDate;
  endDate?: IsoDate | null;
}

/** Trava contra laços longos (recorrência semanal de décadas atrás, por exemplo). */
const MAX_ITERATIONS = 5000;

/**
 * Data da ocorrência de índice `index` (0 = a própria data de início).
 * Mensal e anual guardam o dia original: dia 31 vira 28/02 e volta a ser 31/03.
 */
export function occurrenceDate(rule: RecurrenceRule, index: number): IsoDate {
  if (rule.frequency === RecurrenceFrequency.WEEKLY) return addDays(rule.startDate, index * 7);
  const start = parseIsoDate(rule.startDate);
  if (rule.frequency === RecurrenceFrequency.YEARLY) {
    return clampedDate(start.year + index, start.month, start.day);
  }
  const { year, month } = addMonths(start.year, start.month, index);
  return clampedDate(year, month, start.day);
}

/** Ocorrências em (after, until], respeitando início e fim da recorrência. */
export function recurrenceDates(
  rule: RecurrenceRule,
  after: IsoDate | null,
  until: IsoDate,
): IsoDate[] {
  const end = rule.endDate && rule.endDate < until ? rule.endDate : until;
  const dates: IsoDate[] = [];
  for (let index = 0; index < MAX_ITERATIONS; index++) {
    const date = occurrenceDate(rule, index);
    if (date > end) break;
    if (after === null || date > after) dates.push(date);
  }
  return dates;
}

/** Primeira ocorrência a partir de `from` (inclusive), ou null se a recorrência já terminou. */
export function nextOccurrence(rule: RecurrenceRule, from: IsoDate): IsoDate | null {
  for (let index = 0; index < MAX_ITERATIONS; index++) {
    const date = occurrenceDate(rule, index);
    if (rule.endDate && date > rule.endDate) return null;
    if (date >= from) return date;
  }
  return null;
}

/** Quanto a recorrência pesa por mês, para somar compromissos de frequências diferentes. */
export function monthlyEquivalent(amountCents: Cents, frequency: RecurrenceFrequency): Cents {
  if (frequency === RecurrenceFrequency.WEEKLY) return Math.round((amountCents * 52) / 12);
  if (frequency === RecurrenceFrequency.YEARLY) return Math.round(amountCents / 12);
  return amountCents;
}

/** Data da parcela `index` (0 = primeira): mesmo dia nos meses seguintes, limitado ao fim do mês. */
export function installmentDate(firstDate: IsoDate, index: number): IsoDate {
  return occurrenceDate({ frequency: RecurrenceFrequency.MONTHLY, startDate: firstDate }, index);
}
