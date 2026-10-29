import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, monthBounds } from './dates';

describe('addDays', () => {
  it('atravessa mês e ano', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('daysBetween', () => {
  it('conta dias de calendário sem fuso', () => {
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
    expect(daysBetween('2026-10-31', '2026-10-01')).toBe(-30);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });
});

describe('monthBounds', () => {
  it('retorna o primeiro e o último dia do mês', () => {
    expect(monthBounds('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
    expect(monthBounds('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});
