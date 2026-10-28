import { describe, expect, it } from 'vitest';
import { formatBRL, fromCents, toCents } from './money';
import { clampedDate, todayIso } from './dates';

describe('money', () => {
  it('converte decimais para centavos sem erro de ponto flutuante', () => {
    expect(toCents('0.1') + toCents('0.2')).toBe(toCents('0.3'));
    expect(toCents(1234.56)).toBe(123_456);
    expect(toCents('10,5')).toBe(1_050);
    expect(toCents('-7.01')).toBe(-701);
  });

  it('converte centavos para o formato do banco', () => {
    expect(fromCents(123_456)).toBe('1234.56');
    expect(fromCents(5)).toBe('0.05');
    expect(fromCents(-701)).toBe('-7.01');
  });

  it('formata em reais', () => {
    expect(formatBRL(123_456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
  });

  it('rejeita valores inválidos', () => {
    expect(() => toCents('abc')).toThrow();
    expect(() => toCents('1.234')).toThrow();
  });
});

describe('dates', () => {
  it('limita o dia ao fim do mês', () => {
    expect(clampedDate(2026, 4, 31)).toBe('2026-04-30');
  });

  it('calcula hoje no fuso de São Paulo, não em UTC', () => {
    // 02:00 UTC de 29/10 ainda é 23:00 de 28/10 em São Paulo
    expect(todayIso('America/Sao_Paulo', new Date('2026-10-29T02:00:00Z'))).toBe('2026-10-28');
  });
});
