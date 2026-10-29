import { z } from 'zod';
import { isValidIsoDate } from '../dates';
import { CategoryType, EditScope, RecurrenceFrequency } from '../enums';
import { MAX_AMOUNT_CENTS } from './transaction';

const isoDate = z
  .string({ error: 'Informe a data' })
  .refine(isValidIsoDate, { error: 'Data inválida' });

/**
 * Receita ou despesa que se repete. O dia vem da data de início: "todo dia 5",
 * "toda segunda", "todo 10 de março". Gera lançamentos previstos.
 */
export const recurrenceInputSchema = z
  .object({
    type: z.enum([CategoryType.INCOME, CategoryType.EXPENSE], {
      error: 'Escolha receita ou despesa',
    }),
    accountId: z.guid({ error: 'Escolha a conta' }),
    categoryId: z.guid({ error: 'Escolha a categoria' }),
    amountCents: z
      .int({ error: 'Informe o valor' })
      .min(1, { error: 'O valor deve ser maior que zero' })
      .max(MAX_AMOUNT_CENTS, { error: 'Valor muito alto' }),
    description: z
      .string({ error: 'Informe uma descrição' })
      .trim()
      .min(1, { error: 'Informe uma descrição' })
      .max(200, { error: 'Descrição muito longa' }),
    frequency: z.enum(
      [RecurrenceFrequency.WEEKLY, RecurrenceFrequency.MONTHLY, RecurrenceFrequency.YEARLY],
      { error: 'Escolha a frequência' },
    ),
    startDate: isoDate,
    endDate: isoDate.nullish(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    error: 'O fim vem antes do início',
    path: ['endDate'],
  });
export type RecurrenceInput = z.input<typeof recurrenceInputSchema>;
export type RecurrenceInputParsed = z.output<typeof recurrenceInputSchema>;

/** Alcance de edição/exclusão de parcela ou ocorrência (query string `?scope=`). */
export const editScopeSchema = z.object({
  scope: z.enum([EditScope.THIS, EditScope.FUTURE]).default(EditScope.THIS),
});
export type EditScopeInput = z.output<typeof editScopeSchema>;
