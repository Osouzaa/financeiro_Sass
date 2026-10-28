import { invoiceStatus, invoiceTotals, type InvoiceGroup } from './invoice-math';

const group = (partial: Partial<InvoiceGroup>): InvoiceGroup => ({
  type: 'EXPENSE',
  status: 'PAID',
  transferDirection: null,
  amount: '0',
  ...partial,
});

describe('invoiceTotals', () => {
  it('compras − estornos; pagamentos realizados e agendados separados', () => {
    const totals = invoiceTotals([
      group({ amount: '1500.00' }),
      group({ type: 'INCOME', amount: '100.00' }),
      group({ type: 'TRANSFER', transferDirection: 'IN', amount: '400.00' }),
      group({ type: 'TRANSFER', transferDirection: 'IN', status: 'PLANNED', amount: '1000.00' }),
    ]);
    expect(totals).toEqual({
      purchasesCents: 150_000,
      refundsCents: 10_000,
      totalCents: 140_000,
      paidCents: 40_000,
      scheduledCents: 100_000,
      remainingCents: 100_000,
    });
  });

  it('pagamento acima do total não deixa saldo negativo a pagar', () => {
    const totals = invoiceTotals([
      group({ amount: '100.00' }),
      group({ type: 'TRANSFER', transferDirection: 'IN', amount: '150.00' }),
    ]);
    expect(totals.remainingCents).toBe(0);
  });
});

describe('invoiceStatus', () => {
  const dates = { closingDate: '2026-10-25', dueDate: '2026-11-05' };

  it('aberta antes do dia do fechamento, mesmo se já paga em parte', () => {
    expect(invoiceStatus({ totalCents: 100, paidCents: 50 }, dates, '2026-10-24').status).toBe(
      'OPEN',
    );
  });

  it('fechada no dia do fechamento', () => {
    expect(invoiceStatus({ totalCents: 100, paidCents: 0 }, dates, '2026-10-25')).toEqual({
      status: 'CLOSED',
      overdue: false,
    });
  });

  it('paga em parte e vencida depois do vencimento', () => {
    expect(invoiceStatus({ totalCents: 100, paidCents: 40 }, dates, '2026-11-06')).toEqual({
      status: 'PARTIALLY_PAID',
      overdue: true,
    });
  });

  it('paga quando o pagamento cobre o total; fatura zerada também conta como paga', () => {
    expect(invoiceStatus({ totalCents: 100, paidCents: 100 }, dates, '2026-11-10')).toEqual({
      status: 'PAID',
      overdue: false,
    });
    expect(invoiceStatus({ totalCents: -50, paidCents: 0 }, dates, '2026-11-10').status).toBe(
      'PAID',
    );
  });
});
