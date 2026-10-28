import { AccountType, TransactionStatus, TransactionType, toCents } from '@financeiro/shared';

/** Soma agrupada de lançamentos de uma conta (resultado do groupBy do Prisma). */
export interface TransactionTotal {
  accountId: string;
  type: string;
  status: string;
  transferDirection: string | null;
  /** Soma em formato decimal ("1234.56"). */
  amount: string;
}

/**
 * Efeito de um grupo de lançamentos no saldo de uma conta corrente/carteira.
 * Só lançamentos realizados (PAID) mexem no saldo atual.
 */
function cashEffect(total: TransactionTotal): number {
  if (total.status !== TransactionStatus.PAID) return 0;
  const cents = toCents(total.amount);
  if (total.type === TransactionType.INCOME) return cents;
  if (total.type === TransactionType.EXPENSE) return -cents;
  if (total.type === TransactionType.TRANSFER)
    return total.transferDirection === 'IN' ? cents : -cents;
  return 0;
}

/**
 * Efeito no total em aberto de um cartão (dívida).
 * Compras somam; estornos (receitas) e pagamentos de fatura (transferências que entram) abatem.
 * No cartão, a compra conta mesmo antes de a fatura fechar, então o status não importa.
 */
function cardEffect(total: TransactionTotal): number {
  const cents = toCents(total.amount);
  if (total.type === TransactionType.EXPENSE) return cents;
  if (total.type === TransactionType.INCOME) return -cents;
  if (total.type === TransactionType.TRANSFER)
    return total.transferDirection === 'IN' ? -cents : cents;
  return 0;
}

export interface BalanceResult {
  balanceCents: number;
  availableLimitCents: number | null;
}

export function computeBalance(
  account: { type: string; initialBalanceCents: number; creditLimitCents: number | null },
  totals: TransactionTotal[],
): BalanceResult {
  if (account.type === AccountType.CREDIT_CARD) {
    const owed = totals.reduce((sum, total) => sum + cardEffect(total), 0);
    return {
      balanceCents: owed,
      availableLimitCents:
        account.creditLimitCents === null ? null : account.creditLimitCents - owed,
    };
  }
  const balance = totals.reduce(
    (sum, total) => sum + cashEffect(total),
    account.initialBalanceCents,
  );
  return { balanceCents: balance, availableLimitCents: null };
}
