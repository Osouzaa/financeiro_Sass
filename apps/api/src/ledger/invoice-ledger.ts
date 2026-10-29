import { ConflictException } from '@nestjs/common';
import {
  AccountType,
  InvoiceStatus,
  TransactionStatus,
  fromCents,
  invoiceAfter,
  invoiceForPurchase,
  type InvoicePeriod,
} from '@financeiro/shared';
import { toDbDate } from '../common/db-date';
import type { Prisma } from '../generated/prisma/client';
import type { RulesAccount } from './entry-rules';

type Tx = Prisma.TransactionClient;
type CardFields = Pick<RulesAccount, 'id' | 'closingDay' | 'dueDay'>;

function cycleOf(card: CardFields) {
  if (!card.closingDay || !card.dueDay) {
    throw new ConflictException('Cadastre o fechamento e o vencimento deste cartão');
  }
  return { closingDay: card.closingDay, dueDay: card.dueDay };
}

/** Garante a fatura do período e devolve o id (criada na primeira compra). */
async function upsertInvoice(
  tx: Tx,
  userId: string,
  card: CardFields,
  period: InvoicePeriod,
): Promise<string> {
  const invoice = await tx.invoice.upsert({
    where: {
      accountId_referenceMonth: { accountId: card.id, referenceMonth: period.referenceMonth },
    },
    create: {
      userId,
      accountId: card.id,
      referenceMonth: period.referenceMonth,
      closingDate: toDbDate(period.closingDate),
      dueDate: toDbDate(period.dueDate),
    },
    update: {},
    select: { id: true },
  });
  return invoice.id;
}

/** Fatura em que cai uma compra feita na data informada. */
export function invoiceFor(tx: Tx, userId: string, card: CardFields, date: string) {
  return upsertInvoice(tx, userId, card, invoiceForPurchase(date, cycleOf(card)));
}

/** Fatura da parcela `index` (0 = primeira): a da compra e as dos meses seguintes. */
export function installmentInvoiceFor(
  tx: Tx,
  userId: string,
  card: CardFields,
  purchaseDate: string,
  index: number,
) {
  const cycle = cycleOf(card);
  const base = invoiceForPurchase(purchaseDate, cycle);
  return upsertInvoice(tx, userId, card, index === 0 ? base : invoiceAfter(base, index, cycle));
}

/**
 * Fatura que um pagamento sem fatura escolhida quita: a última fechada até a data
 * (é a que se paga no vencimento). Sem nenhuma fechada, a fatura em aberto.
 */
export async function paymentInvoiceFor(
  tx: Tx,
  userId: string,
  card: CardFields,
  date: string,
): Promise<string> {
  const closed = await tx.invoice.findFirst({
    where: { userId, accountId: card.id, closingDate: { lte: toDbDate(date) } },
    orderBy: { closingDate: 'desc' },
    select: { id: true },
  });
  return closed?.id ?? invoiceFor(tx, userId, card, date);
}

/** Faturas abertas que ficaram sem lançamentos não devem travar a exclusão do cartão. */
export async function removeEmptyInvoices(tx: Tx, ids: (string | null)[]): Promise<void> {
  const list = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (list.length === 0) return;
  await tx.invoice.deleteMany({
    where: { id: { in: list }, status: InvoiceStatus.OPEN, transactions: { none: {} } },
  });
}

export interface EntryValues {
  type: 'INCOME' | 'EXPENSE';
  categoryId: string;
  amountCents: number;
  description: string;
  notes?: string | null;
  date: string;
  status: TransactionStatus;
}

/**
 * Dados de receita/despesa. No cartão não há data de caixa: o dinheiro sai
 * quando a fatura é paga, e a compra vai para a fatura do período (ou a
 * informada, no caso de parcelas).
 */
export async function entryData(
  tx: Tx,
  userId: string,
  account: CardFields & { type: string },
  values: EntryValues,
  invoiceId?: string,
) {
  const isCard = account.type === AccountType.CREDIT_CARD;
  return {
    accountId: account.id,
    categoryId: values.categoryId,
    type: values.type,
    amount: fromCents(values.amountCents),
    description: values.description,
    notes: values.notes ?? null,
    competenceDate: toDbDate(values.date),
    cashDate: isCard ? null : toDbDate(values.date),
    status: isCard ? TransactionStatus.PAID : values.status,
    invoiceId: isCard ? (invoiceId ?? (await invoiceFor(tx, userId, account, values.date))) : null,
  };
}
