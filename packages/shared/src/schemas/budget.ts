import { z } from 'zod';
import { parseYearMonth } from '../dates';
import { MAX_AMOUNT_CENTS } from './transaction';

const yearMonth = z.string({ error: 'Informe o mês' }).refine(
  (value) => {
    try {
      parseYearMonth(value);
      return true;
    } catch {
      return false;
    }
  },
  { error: 'Mês inválido (use AAAA-MM)' },
);

/** Limite mensal de uma categoria principal de despesa (subcategorias somam nela). */
export const budgetInputSchema = z.object({
  month: yearMonth,
  categoryId: z.guid({ error: 'Escolha a categoria' }),
  limitCents: z
    .int({ error: 'Informe o limite' })
    .min(1, { error: 'O limite deve ser maior que zero' })
    .max(MAX_AMOUNT_CENTS, { error: 'Valor muito alto' }),
});
export type BudgetInput = z.input<typeof budgetInputSchema>;
export type BudgetInputParsed = z.output<typeof budgetInputSchema>;

export const budgetMonthSchema = z.object({ month: yearMonth });

/** Copia os limites de um mês para outro, sem sobrescrever o que já existe no destino. */
export const budgetCopySchema = z
  .object({ from: yearMonth, to: yearMonth })
  .refine((data) => data.from !== data.to, {
    error: 'Escolha meses diferentes',
    path: ['to'],
  });
export type BudgetCopyInput = z.output<typeof budgetCopySchema>;

export const projectionQuerySchema = z.object({
  /** Quantos dias à frente, a partir de hoje. */
  days: z.coerce
    .number({ error: 'Período inválido' })
    .int({ error: 'Período inválido' })
    .min(7, { error: 'Mínimo de 7 dias' })
    .max(365, { error: 'Máximo de 365 dias' })
    .default(90),
  /** Só uma conta corrente/carteira (com as faturas dos cartões que ela paga). */
  accountId: z.guid({ error: 'Conta inválida' }).optional(),
});
export type ProjectionQuery = z.output<typeof projectionQuerySchema>;
