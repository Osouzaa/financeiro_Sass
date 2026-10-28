import type { Cents } from './money';

/**
 * Divide um valor em parcelas.
 *
 * Regra da especificação: cada parcela recebe o valor truncado em centavos
 * e a diferença vai para a PRIMEIRA parcela.
 * Ex.: R$ 100,00 em 3x = 33,34 + 33,33 + 33,33.
 */
export function splitInstallments(totalCents: Cents, count: number): Cents[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new Error('O valor total deve ser um inteiro positivo em centavos');
  }
  if (!Number.isInteger(count) || count < 1 || count > 120) {
    throw new Error('A quantidade de parcelas deve estar entre 1 e 120');
  }
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => (index === 0 ? base + remainder : base));
}
