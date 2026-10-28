import {
  addMonths,
  clampedDate,
  formatYearMonth,
  parseIsoDate,
  type IsoDate,
  type YearMonth,
} from './dates';

/**
 * Regras de fatura de cartão de crédito (ver especificação do MVP).
 *
 * - Compra ANTES do dia de fechamento: entra na fatura que fecha neste mês.
 * - Compra NO DIA ou DEPOIS do fechamento: entra na fatura que fecha no mês seguinte.
 * - Se o vencimento é um dia menor ou igual ao fechamento (ex.: fecha 25, vence 5),
 *   o vencimento cai no mês seguinte ao fechamento.
 * - Dias que não existem no mês (31 em fevereiro) viram o último dia do mês.
 * - O mês de referência da fatura é o mês do VENCIMENTO, como os bancos
 *   costumam nomear ("fatura de dezembro").
 */

export interface CardCycle {
  closingDay: number;
  dueDay: number;
}

export interface InvoicePeriod {
  /** Mês do vencimento, `YYYY-MM`. Identifica a fatura junto com a conta. */
  referenceMonth: YearMonth;
  closingDate: IsoDate;
  dueDate: IsoDate;
}

export function assertValidCycle({ closingDay, dueDay }: CardCycle): void {
  for (const [name, day] of [
    ['closingDay', closingDay],
    ['dueDay', dueDay],
  ] as const) {
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error(`${name} deve ser um inteiro entre 1 e 31 (recebido: ${day})`);
    }
  }
}

/** Fatura cujo fechamento acontece no mês informado. */
export function invoiceClosingIn(year: number, month: number, cycle: CardCycle): InvoicePeriod {
  assertValidCycle(cycle);
  const closingDate = clampedDate(year, month, cycle.closingDay);
  const due = cycle.dueDay > cycle.closingDay ? { year, month } : addMonths(year, month, 1);
  return {
    referenceMonth: formatYearMonth(due.year, due.month),
    closingDate,
    dueDate: clampedDate(due.year, due.month, cycle.dueDay),
  };
}

/** Em qual fatura cai uma compra feita na data informada. */
export function invoiceForPurchase(purchaseDate: IsoDate, cycle: CardCycle): InvoicePeriod {
  const { year, month } = parseIsoDate(purchaseDate);
  const current = invoiceClosingIn(year, month, cycle);
  if (purchaseDate < current.closingDate) return current;
  const next = addMonths(year, month, 1);
  return invoiceClosingIn(next.year, next.month, cycle);
}

/**
 * Fatura N meses depois de uma fatura base. Usado em parcelamentos:
 * a parcela 1 cai na fatura da compra, a parcela k na fatura k-1 meses depois.
 */
export function invoiceAfter(base: InvoicePeriod, months: number, cycle: CardCycle): InvoicePeriod {
  const { year, month } = parseIsoDate(base.closingDate);
  const target = addMonths(year, month, months);
  return invoiceClosingIn(target.year, target.month, cycle);
}
