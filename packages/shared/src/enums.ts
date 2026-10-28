/**
 * Enums de domínio.
 *
 * O SQL Server não tem tipo enum, então no banco esses valores são VARCHAR
 * e a validação acontece na aplicação (Zod). Usar `as const` mantém os
 * valores como fonte única de verdade para API e front.
 */

export const AccountType = {
  CHECKING: 'CHECKING',
  WALLET: 'WALLET',
  CREDIT_CARD: 'CREDIT_CARD',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const CategoryType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;
export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType];

export const TransactionType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  TRANSFER: 'TRANSFER',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  PLANNED: 'PLANNED',
  PAID: 'PAID',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const InvoiceStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const RecurrenceFrequency = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;
export type RecurrenceFrequency = (typeof RecurrenceFrequency)[keyof typeof RecurrenceFrequency];

/** Alcance de uma edição em lançamento recorrente ou parcelado. */
export const EditScope = {
  THIS: 'this',
  FUTURE: 'future',
} as const;
export type EditScope = (typeof EditScope)[keyof typeof EditScope];

/** Rótulos em português para exibição. */
export const accountTypeLabels: Record<AccountType, string> = {
  CHECKING: 'Conta corrente',
  WALLET: 'Carteira',
  CREDIT_CARD: 'Cartão de crédito',
};

export const transactionTypeLabels: Record<TransactionType, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
  TRANSFER: 'Transferência',
};

export const transactionStatusLabels: Record<TransactionStatus, string> = {
  PLANNED: 'Previsto',
  PAID: 'Realizado',
};
