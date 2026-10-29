import { describe, expect, it } from 'vitest';
import { adminSubscriptionSchema, planInputSchema } from './plan';

const plan = {
  code: 'pro',
  name: 'Pro',
  priceCents: 1490,
  interval: 'MONTH',
  isPublic: true,
  isActive: true,
  highlighted: true,
  sortOrder: 2,
  features: ['Contas ilimitadas'],
  limits: {
    maxAccounts: null,
    maxCards: null,
    maxRecurrences: null,
    maxBudgets: null,
    projectionDays: 365,
    whatsapp: true,
  },
};

describe('planInputSchema', () => {
  it('aceita plano válido; null nos limites significa ilimitado', () => {
    expect(planInputSchema.safeParse(plan).success).toBe(true);
  });

  it('recusa código fora do padrão, preço negativo e limite negativo', () => {
    expect(planInputSchema.safeParse({ ...plan, code: 'Pro Plus!' }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...plan, priceCents: -1 }).success).toBe(false);
    expect(
      planInputSchema.safeParse({ ...plan, limits: { ...plan.limits, maxAccounts: -2 } }).success,
    ).toBe(false);
  });
});

describe('adminSubscriptionSchema', () => {
  it('aceita sem data de fim e recusa status desconhecido', () => {
    const planId = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
    expect(adminSubscriptionSchema.parse({ planId, status: 'ACTIVE' }).currentPeriodEnd).toBeNull();
    expect(adminSubscriptionSchema.safeParse({ planId, status: 'GRATIS' }).success).toBe(false);
  });
});
