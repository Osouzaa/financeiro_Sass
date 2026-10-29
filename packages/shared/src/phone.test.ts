import { describe, expect, it } from 'vitest';
import { formatPhone, isValidBrMobile, toE164 } from './phone';

describe('celular brasileiro', () => {
  it('aceita os formatos que as pessoas digitam', () => {
    for (const value of ['(11) 99999-8888', '11999998888', '+55 11 99999-8888', '5511999998888']) {
      expect(isValidBrMobile(value)).toBe(true);
      expect(toE164(value)).toBe('+5511999998888');
    }
  });

  it('recusa fixo, DDD inexistente e tamanho errado', () => {
    expect(isValidBrMobile('(11) 3333-4444')).toBe(false);
    expect(isValidBrMobile('(20) 99999-8888')).toBe(false);
    expect(isValidBrMobile('(11) 9999-888')).toBe(false);
    expect(isValidBrMobile('<script>')).toBe(false);
  });

  it('formata enquanto digita', () => {
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('1199999')).toBe('(11) 99999');
    expect(formatPhone('11999998888')).toBe('(11) 99999-8888');
    expect(formatPhone('+5511999998888')).toBe('(11) 99999-8888');
  });
});
