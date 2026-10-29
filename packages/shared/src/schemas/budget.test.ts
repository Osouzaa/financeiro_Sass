import { describe, expect, it } from 'vitest';
import { budgetCopySchema, budgetInputSchema, projectionQuerySchema } from './budget';

describe('budgetInputSchema', () => {
  const budget = {
    month: '2026-11',
    categoryId: '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
    limitCents: 80_000,
  };

  it('aceita limite válido', () => {
    expect(budgetInputSchema.safeParse(budget).success).toBe(true);
  });

  it('recusa mês inválido e limite zero', () => {
    expect(budgetInputSchema.safeParse({ ...budget, month: '2026-13' }).success).toBe(false);
    expect(budgetInputSchema.safeParse({ ...budget, month: "2026-11'--" }).success).toBe(false);
    expect(budgetInputSchema.safeParse({ ...budget, limitCents: 0 }).success).toBe(false);
  });
});

describe('budgetCopySchema', () => {
  it('recusa copiar para o mesmo mês', () => {
    expect(budgetCopySchema.safeParse({ from: '2026-10', to: '2026-10' }).success).toBe(false);
  });
});

describe('projectionQuerySchema', () => {
  it('converte dias da query string e aplica o padrão', () => {
    expect(projectionQuerySchema.parse({ days: '30' }).days).toBe(30);
    expect(projectionQuerySchema.parse({}).days).toBe(90);
    expect(projectionQuerySchema.safeParse({ days: '5000' }).success).toBe(false);
    expect(projectionQuerySchema.safeParse({ days: 'abc' }).success).toBe(false);
  });
});
