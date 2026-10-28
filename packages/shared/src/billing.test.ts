import { describe, expect, it } from 'vitest';
import { invoiceAfter, invoiceClosingIn, invoiceForPurchase } from './billing';

describe('invoiceForPurchase', () => {
  // Exemplo da especificação: fecha dia 25, vence dia 5
  const cycle = { closingDay: 25, dueDay: 5 };

  it('compra antes do fechamento cai na fatura que fecha no mesmo mês', () => {
    expect(invoiceForPurchase('2026-11-20', cycle)).toEqual({
      referenceMonth: '2026-12',
      closingDate: '2026-11-25',
      dueDate: '2026-12-05',
    });
  });

  it('compra no dia do fechamento cai na fatura seguinte', () => {
    expect(invoiceForPurchase('2026-11-25', cycle).dueDate).toBe('2027-01-05');
  });

  it('compra depois do fechamento cai na fatura seguinte', () => {
    expect(invoiceForPurchase('2026-11-28', cycle)).toEqual({
      referenceMonth: '2027-01',
      closingDate: '2026-12-25',
      dueDate: '2027-01-05',
    });
  });

  it('vira o ano corretamente', () => {
    expect(invoiceForPurchase('2026-12-30', cycle)).toEqual({
      referenceMonth: '2027-02',
      closingDate: '2027-01-25',
      dueDate: '2027-02-05',
    });
  });

  it('vencimento depois do fechamento fica no mesmo mês', () => {
    // Fecha dia 3, vence dia 10
    expect(invoiceForPurchase('2026-11-01', { closingDay: 3, dueDay: 10 })).toEqual({
      referenceMonth: '2026-11',
      closingDate: '2026-11-03',
      dueDate: '2026-11-10',
    });
  });

  it('dia 31 em mês curto vira o último dia do mês', () => {
    const endOfMonth = { closingDay: 31, dueDay: 10 };
    // Fevereiro de 2027 tem 28 dias: fechamento em 28/02
    expect(invoiceForPurchase('2027-02-27', endOfMonth).closingDate).toBe('2027-02-28');
    // Compra em 28/02 já é no dia do fechamento: vai para a fatura de março
    expect(invoiceForPurchase('2027-02-28', endOfMonth).closingDate).toBe('2027-03-31');
  });

  it('considera ano bissexto', () => {
    expect(invoiceClosingIn(2028, 2, { closingDay: 30, dueDay: 8 }).closingDate).toBe('2028-02-29');
  });

  it('rejeita dias fora do intervalo', () => {
    expect(() => invoiceForPurchase('2026-11-01', { closingDay: 0, dueDay: 5 })).toThrow();
    expect(() => invoiceForPurchase('2026-11-01', { closingDay: 25, dueDay: 32 })).toThrow();
  });
});

describe('invoiceAfter', () => {
  it('avança faturas mês a mês para parcelamentos', () => {
    const cycle = { closingDay: 25, dueDay: 5 };
    const first = invoiceForPurchase('2026-11-20', cycle);
    expect(invoiceAfter(first, 1, cycle).referenceMonth).toBe('2027-01');
    expect(invoiceAfter(first, 9, cycle).referenceMonth).toBe('2027-09');
  });
});
