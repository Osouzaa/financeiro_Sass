import { z } from 'zod';
import { isValidIsoDate } from '../dates';
import { AccountType } from '../enums';

const day = z.int().min(1, { error: 'Dia entre 1 e 31' }).max(31, { error: 'Dia entre 1 e 31' });

/**
 * Cadastro e edição de conta. Valores monetários trafegam em centavos (inteiros).
 * Campos de cartão só valem para CREDIT_CARD e são obrigatórios nesse caso.
 */
export const accountInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: 'Informe um nome' })
      .max(80, { error: 'Nome muito longo' }),
    type: z.enum([AccountType.CHECKING, AccountType.WALLET, AccountType.CREDIT_CARD], {
      error: 'Escolha o tipo da conta',
    }),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, { error: 'Cor inválida' })
      .nullish(),
    initialBalanceCents: z.int({ error: 'Informe o saldo inicial' }).default(0),
    initialBalanceDate: z.string().refine(isValidIsoDate, { error: 'Data inválida' }),
    closingDay: day.nullish(),
    dueDay: day.nullish(),
    creditLimitCents: z.int().min(0, { error: 'O limite não pode ser negativo' }).nullish(),
    paymentAccountId: z.guid({ error: 'Conta inválida' }).nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== AccountType.CREDIT_CARD) return;
    if (data.closingDay == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['closingDay'],
        message: 'Informe o dia de fechamento',
      });
    }
    if (data.dueDay == null) {
      ctx.addIssue({ code: 'custom', path: ['dueDay'], message: 'Informe o dia de vencimento' });
    }
    if (data.creditLimitCents == null) {
      ctx.addIssue({ code: 'custom', path: ['creditLimitCents'], message: 'Informe o limite' });
    }
  })
  .transform((data) =>
    data.type === AccountType.CREDIT_CARD
      ? { ...data, initialBalanceCents: 0 }
      : { ...data, closingDay: null, dueDay: null, creditLimitCents: null, paymentAccountId: null },
  );
export type AccountInput = z.input<typeof accountInputSchema>;
export type AccountInputParsed = z.output<typeof accountInputSchema>;
