import { describe, expect, it } from 'vitest';
import { installmentDate, monthlyEquivalent, nextOccurrence, recurrenceDates } from './recurrence';

describe('recurrenceDates', () => {
  it('mensal mantém o dia original mesmo depois de um mês curto', () => {
    const rule = { frequency: 'MONTHLY' as const, startDate: '2026-01-31' };
    expect(recurrenceDates(rule, null, '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('gera só depois de `after` e respeita a data de fim', () => {
    const rule = { frequency: 'MONTHLY' as const, startDate: '2026-01-05', endDate: '2026-04-05' };
    expect(recurrenceDates(rule, '2026-02-05', '2026-12-31')).toEqual(['2026-03-05', '2026-04-05']);
  });

  it('semanal e anual (29/02 vira 28/02 em anos comuns)', () => {
    expect(
      recurrenceDates({ frequency: 'WEEKLY', startDate: '2026-12-28' }, null, '2027-01-12'),
    ).toEqual(['2026-12-28', '2027-01-04', '2027-01-11']);
    expect(
      recurrenceDates({ frequency: 'YEARLY', startDate: '2028-02-29' }, null, '2030-03-01'),
    ).toEqual(['2028-02-29', '2029-02-28', '2030-02-28']);
  });
});

describe('nextOccurrence', () => {
  it('próxima a partir de hoje, ou null depois do fim', () => {
    const rule = { frequency: 'MONTHLY' as const, startDate: '2026-01-10' };
    expect(nextOccurrence(rule, '2026-10-11')).toBe('2026-11-10');
    expect(nextOccurrence({ ...rule, endDate: '2026-10-10' }, '2026-10-11')).toBeNull();
  });
});

describe('monthlyEquivalent', () => {
  it('converte semanal e anual para o peso mensal', () => {
    expect(monthlyEquivalent(10_000, 'WEEKLY')).toBe(43_333);
    expect(monthlyEquivalent(120_000, 'YEARLY')).toBe(10_000);
    expect(monthlyEquivalent(5_000, 'MONTHLY')).toBe(5_000);
  });
});

describe('installmentDate', () => {
  it('parcelas mensais no mesmo dia', () => {
    expect([0, 1, 2].map((index) => installmentDate('2026-11-30', index))).toEqual([
      '2026-11-30',
      '2026-12-30',
      '2027-01-30',
    ]);
  });
});
