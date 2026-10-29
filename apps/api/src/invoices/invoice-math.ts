import {
  InvoiceStatus,
  TransactionStatus,
  TransactionType,
  toCents,
  type IsoDate,
} from '@financeiro/shared';

/** Soma agrupada dos lançamentos de uma fatura (resultado do groupBy do Prisma). */
export interface InvoiceGroup {
  type: string;
  status: string;
  transferDirection: string | null;
  /** Soma em formato decimal ("1234.56"). */
  amount: string;
}

export interface InvoiceTotals {
  purchasesCents: number;
  refundsCents: number;
  totalCents: number;
  paidCents: number;
  scheduledCents: number;
  remainingCents: number;
}

/**
 * Compras somam, estornos abatem. Pagamentos são transferências que entram no
 * cartão: só os realizados contam como pagos; os previstos ficam como agendados.
 */
export function invoiceTotals(groups: InvoiceGroup[]): InvoiceTotals {
  let purchasesCents = 0;
  let refundsCents = 0;
  let paidCents = 0;
  let scheduledCents = 0;

  for (const group of groups) {
    const cents = toCents(group.amount);
    if (group.type === TransactionType.EXPENSE) purchasesCents += cents;
    else if (group.type === TransactionType.INCOME) refundsCents += cents;
    else if (group.type === TransactionType.TRANSFER && group.transferDirection === 'IN') {
      if (group.status === TransactionStatus.PAID) paidCents += cents;
      else scheduledCents += cents;
    }
  }

  const totalCents = purchasesCents - refundsCents;
  return {
    purchasesCents,
    refundsCents,
    totalCents,
    paidCents,
    scheduledCents,
    remainingCents: Math.max(0, totalCents - paidCents),
  };
}

/**
 * Status calculado, nunca gravado: assim não fica fora de sincronia com os lançamentos.
 * Compras feitas no dia do fechamento já vão para a próxima fatura, então a fatura
 * está fechada a partir do dia do fechamento.
 */
export function invoiceStatus(
  totals: Pick<InvoiceTotals, 'totalCents' | 'paidCents'>,
  dates: { closingDate: IsoDate; dueDate: IsoDate },
  today: IsoDate,
): { status: InvoiceStatus; overdue: boolean } {
  if (today < dates.closingDate) return { status: InvoiceStatus.OPEN, overdue: false };

  const status =
    totals.totalCents <= 0 || totals.paidCents >= totals.totalCents
      ? InvoiceStatus.PAID
      : totals.paidCents > 0
        ? InvoiceStatus.PARTIALLY_PAID
        : InvoiceStatus.CLOSED;
  return { status, overdue: status !== InvoiceStatus.PAID && today > dates.dueDate };
}
