import { describe, expect, it } from 'vitest';
import { accountInputSchema } from './account';

const base = { name: 'Nubank', initialBalanceDate: '2026-10-28' };

describe('accountInputSchema', () => {
  it('cartão exige fechamento, vencimento e limite', () => {
    const result = accountInputSchema.safeParse({ ...base, type: 'CREDIT_CARD' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['closingDay', 'dueDay', 'creditLimitCents']));
  });

  it('cartão ignora saldo inicial', () => {
    const parsed = accountInputSchema.parse({
      ...base,
      type: 'CREDIT_CARD',
      initialBalanceCents: 5000,
      closingDay: 25,
      dueDay: 5,
      creditLimitCents: 500_000,
    });
    expect(parsed.initialBalanceCents).toBe(0);
  });

  it('conta corrente descarta campos de cartão', () => {
    const parsed = accountInputSchema.parse({
      ...base,
      type: 'CHECKING',
      initialBalanceCents: -1500,
      closingDay: 25,
      creditLimitCents: 100,
    });
    expect(parsed).toMatchObject({
      initialBalanceCents: -1500,
      closingDay: null,
      creditLimitCents: null,
    });
  });

  it('recusa data inválida', () => {
    expect(
      accountInputSchema.safeParse({ ...base, type: 'WALLET', initialBalanceDate: '2026-02-30' })
        .success,
    ).toBe(false);
  });
});
