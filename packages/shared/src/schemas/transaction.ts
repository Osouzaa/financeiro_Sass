import { z } from 'zod';
import { daysBetween, isValidIsoDate } from '../dates';
import { TransactionStatus, TransactionType } from '../enums';

/** Até R$ 999.999.999,99: cabe no DECIMAL(19,2) e continua um inteiro seguro. */
export const MAX_AMOUNT_CENTS = 99_999_999_999;

/** Mesmo limite de `splitInstallments`. */
export const MAX_INSTALLMENTS = 120;

/** Maior intervalo aceito na listagem, para a consulta não varrer anos de dados. */
export const MAX_FILTER_DAYS = 366;

const amountCents = z
  .int({ error: 'Informe o valor' })
  .min(1, { error: 'O valor deve ser maior que zero' })
  .max(MAX_AMOUNT_CENTS, { error: 'Valor muito alto' });

const isoDate = z
  .string({ error: 'Informe a data' })
  .refine(isValidIsoDate, { error: 'Data inválida' });

const description = z
  .string({ error: 'Informe uma descrição' })
  .trim()
  .min(1, { error: 'Informe uma descrição' })
  .max(200, { error: 'Descrição muito longa' });

const notes = z
  .string()
  .trim()
  .max(1000, { error: 'Observação muito longa' })
  .nullish()
  .transform((value) => value || null);

const status = z.enum([TransactionStatus.PLANNED, TransactionStatus.PAID], {
  error: 'Escolha o status',
});

/**
 * Receita ou despesa. Valor sempre positivo em centavos; o tipo define o sinal.
 * `date` é a data de competência (quando aconteceu). Em conta corrente/carteira
 * é também a data de caixa; no cartão, a fatura é calculada a partir dela.
 */
export const transactionInputSchema = z.object({
  type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE], {
    error: 'Escolha receita ou despesa',
  }),
  accountId: z.guid({ error: 'Escolha a conta' }),
  categoryId: z.guid({ error: 'Escolha a categoria' }),
  amountCents,
  description,
  notes,
  date: isoDate,
  status,
  /**
   * Parcelas (só no cadastro de despesa). O valor é o total da compra: cada parcela
   * recebe a divisão em centavos, com a sobra na primeira. Ignorado na edição.
   */
  installments: z
    .int({ error: 'Parcelas inválidas' })
    .min(1, { error: 'Mínimo de 1 parcela' })
    .max(MAX_INSTALLMENTS, { error: `Máximo de ${MAX_INSTALLMENTS} parcelas` })
    .default(1),
});
export type TransactionInput = z.input<typeof transactionInputSchema>;
export type TransactionInputParsed = z.output<typeof transactionInputSchema>;

/** Transferência entre contas do próprio usuário (inclui pagamento de cartão). */
export const transferInputSchema = z
  .object({
    fromAccountId: z.guid({ error: 'Escolha a conta de origem' }),
    toAccountId: z.guid({ error: 'Escolha a conta de destino' }),
    amountCents,
    description,
    notes,
    date: isoDate,
    status,
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    error: 'Escolha uma conta diferente da origem',
    path: ['toAccountId'],
  });
export type TransferInput = z.input<typeof transferInputSchema>;
export type TransferInputParsed = z.output<typeof transferInputSchema>;

export const transactionStatusSchema = z.object({ status });
export type TransactionStatusInput = z.infer<typeof transactionStatusSchema>;

/** Filtros da listagem (query string). O período é obrigatório e limitado. */
export const transactionFilterSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    accountId: z.guid({ error: 'Conta inválida' }).optional(),
    /** Inclui as subcategorias. */
    categoryId: z.guid({ error: 'Categoria inválida' }).optional(),
    type: z
      .enum([TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER])
      .optional(),
    status: status.optional(),
    q: z
      .string()
      .trim()
      .max(100, { error: 'Busca muito longa' })
      .optional()
      .transform((value) => value || undefined),
  })
  .superRefine((data, ctx) => {
    if (!isValidIsoDate(data.from) || !isValidIsoDate(data.to)) return;
    const days = daysBetween(data.from, data.to);
    if (days < 0) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'O fim vem antes do início' });
    } else if (days > MAX_FILTER_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Período máximo de um ano' });
    }
  });
export type TransactionFilter = z.input<typeof transactionFilterSchema>;
export type TransactionFilterParsed = z.output<typeof transactionFilterSchema>;
