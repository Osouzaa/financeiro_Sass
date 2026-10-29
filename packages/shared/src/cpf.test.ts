import { describe, expect, it } from 'vitest';
import { formatCpf, isValidCpf, maskCpf, normalizeCpf, parseLoginIdentifier } from './cpf';

describe('isValidCpf', () => {
  it('aceita CPFs válidos com ou sem pontuação', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('recusa dígito verificador errado, tamanho errado e sequências repetidas', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('000.000.000-00')).toBe(false);
  });
});

describe('formatação', () => {
  it('normaliza, formata enquanto digita e mascara', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(formatCpf('5299')).toBe('529.9');
    expect(formatCpf('5299822')).toBe('529.982.2');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(maskCpf('52998224725')).toBe('***.982.247-**');
  });
});

describe('parseLoginIdentifier', () => {
  it('reconhece e-mail e CPF', () => {
    expect(parseLoginIdentifier(' Gabriel@Exemplo.com ')).toEqual({ email: 'gabriel@exemplo.com' });
    expect(parseLoginIdentifier('529.982.247-25')).toEqual({ cpf: '52998224725' });
  });

  it('recusa o que não é nenhum dos dois', () => {
    expect(parseLoginIdentifier('gabriel')).toBeNull();
    expect(parseLoginIdentifier('529.982.247-24')).toBeNull();
    expect(parseLoginIdentifier("' OR 1=1 --")).toBeNull();
  });
});
