/**
 * Dinheiro em centavos (inteiros).
 *
 * Toda conta é feita em centavos para evitar erros de ponto flutuante
 * (0.1 + 0.2 !== 0.3). No banco o valor é DECIMAL(19,2); a conversão
 * acontece apenas nas bordas (API <-> banco, front <-> usuário).
 */

export type Cents = number;

/** Converte um valor decimal (ex.: "1234.56" ou 1234.56) para centavos. */
export function toCents(value: number | string): Cents {
  const text = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const match = /^(-)?(\d+)(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`Valor monetário inválido: "${value}"`);
  const [, sign, units, fraction = ''] = match;
  const cents = Number(units) * 100 + Number(fraction.padEnd(2, '0'));
  return sign ? -cents : cents;
}

/** Converte centavos para string decimal com 2 casas (formato aceito pelo banco). */
export function fromCents(cents: Cents): string {
  assertInteger(cents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos como moeda brasileira: 123456 -> "R$ 1.234,56". */
export function formatBRL(cents: Cents): string {
  assertInteger(cents);
  return brl.format(cents / 100);
}

function assertInteger(cents: number): void {
  if (!Number.isSafeInteger(cents)) throw new Error(`Centavos devem ser inteiros: ${cents}`);
}
