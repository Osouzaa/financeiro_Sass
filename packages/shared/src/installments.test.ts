import { describe, expect, it } from 'vitest';
import { splitInstallments } from './installments';

describe('splitInstallments', () => {
  it('coloca a diferença de centavos na primeira parcela', () => {
    expect(splitInstallments(10_000, 3)).toEqual([3_334, 3_333, 3_333]);
  });

  it('divide valores exatos igualmente', () => {
    expect(splitInstallments(120_000, 10)).toEqual(Array(10).fill(12_000));
  });

  it('a soma das parcelas é sempre igual ao total', () => {
    for (const [total, count] of [
      [99_999, 7],
      [1, 1],
      [12_345, 12],
    ] as const) {
      const parts = splitInstallments(total, count);
      expect(parts).toHaveLength(count);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
    }
  });

  it('rejeita entradas inválidas', () => {
    expect(() => splitInstallments(0, 2)).toThrow();
    expect(() => splitInstallments(100.5, 2)).toThrow();
    expect(() => splitInstallments(100, 0)).toThrow();
  });
});
