import { z } from 'zod';
import { isValidIsoDate } from '../dates';
import { MAX_AMOUNT_CENTS } from './transaction';

export const UserRole = { USER: 'USER', SUPER_ADMIN: 'SUPER_ADMIN' } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' } as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const SubscriptionStatus = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  TRIALING: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente',
  CANCELED: 'Cancelada',
};

export const PlanInterval = { MONTH: 'MONTH', YEAR: 'YEAR' } as const;
export type PlanInterval = (typeof PlanInterval)[keyof typeof PlanInterval];

/** Código do plano de quem não tem assinatura (ou cuja assinatura acabou). */
export const FREE_PLAN_CODE = 'free';

/** null = sem limite. */
const limit = z
  .int({ error: 'Use um número inteiro' })
  .min(0, { error: 'Não pode ser negativo' })
  .max(100_000, { error: 'Valor muito alto' })
  .nullable();

export const planLimitsSchema = z.object({
  maxAccounts: limit,
  maxCards: limit,
  maxRecurrences: limit,
  maxBudgets: limit,
  projectionDays: z
    .int({ error: 'Use um número inteiro' })
    .min(7, { error: 'Mínimo de 7 dias' })
    .max(365, { error: 'Máximo de 365 dias' }),
  whatsapp: z.boolean(),
});
export type PlanLimits = z.infer<typeof planLimitsSchema>;

/** Cadastro e edição de plano pelo super administrador. */
export const planInputSchema = z.object({
  code: z
    .string({ error: 'Informe o código' })
    .trim()
    .regex(/^[a-z0-9-]{2,30}$/, { error: 'Use letras minúsculas, números e hífen (ex.: pro)' }),
  name: z
    .string()
    .trim()
    .min(1, { error: 'Informe o nome' })
    .max(40, { error: 'Nome muito longo' }),
  description: z.string().trim().max(200, { error: 'Descrição muito longa' }).default(''),
  priceCents: z
    .int({ error: 'Informe o preço' })
    .min(0, { error: 'O preço não pode ser negativo' })
    .max(MAX_AMOUNT_CENTS),
  interval: z.enum([PlanInterval.MONTH, PlanInterval.YEAR]),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  highlighted: z.boolean(),
  sortOrder: z.int().min(0).max(1000),
  features: z
    .array(z.string().trim().min(1).max(80, { error: 'Item muito longo' }))
    .max(10, { error: 'No máximo 10 itens' }),
  limits: planLimitsSchema,
});
export type PlanInput = z.input<typeof planInputSchema>;
export type PlanInputParsed = z.output<typeof planInputSchema>;

/** O super administrador troca o plano de qualquer conta, inclusive a dele. */
export const adminSubscriptionSchema = z.object({
  planId: z.guid({ error: 'Escolha o plano' }),
  status: z.enum([
    SubscriptionStatus.TRIALING,
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.CANCELED,
  ]),
  currentPeriodEnd: z
    .string()
    .refine(isValidIsoDate, { error: 'Data inválida' })
    .nullish()
    .transform((value) => value || null),
});
export type AdminSubscriptionInput = z.input<typeof adminSubscriptionSchema>;
export type AdminSubscriptionInputParsed = z.output<typeof adminSubscriptionSchema>;

export const adminUsersQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type AdminUsersQuery = z.output<typeof adminUsersQuerySchema>;
