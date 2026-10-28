import { z } from 'zod';
import { isValidIsoDate } from '../dates';
import { TransactionStatus } from '../enums';
import { MAX_AMOUNT_CENTS } from './transaction';

/** Pagamento de fatura: vira uma transferência da conta escolhida para o cartão. */
export const invoicePaymentSchema = z.object({
  fromAccountId: z.guid({ error: 'Escolha de qual conta sai o pagamento' }),
  amountCents: z
    .int({ error: 'Informe o valor' })
    .min(1, { error: 'O valor deve ser maior que zero' })
    .max(MAX_AMOUNT_CENTS, { error: 'Valor muito alto' }),
  date: z.string({ error: 'Informe a data' }).refine(isValidIsoDate, { error: 'Data inválida' }),
  status: z.enum([TransactionStatus.PLANNED, TransactionStatus.PAID], {
    error: 'Escolha o status',
  }),
});
export type InvoicePaymentInput = z.input<typeof invoicePaymentSchema>;
export type InvoicePaymentInputParsed = z.output<typeof invoicePaymentSchema>;

export const invoiceFilterSchema = z.object({
  accountId: z.guid({ error: 'Cartão inválido' }).optional(),
  /** Só faturas com valor a pagar. */
  unpaid: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type InvoiceFilterParsed = z.output<typeof invoiceFilterSchema>;
