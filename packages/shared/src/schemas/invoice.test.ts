import { describe, expect, it } from 'vitest';
import { invoiceFilterSchema, invoicePaymentSchema } from './invoice';

describe('invoicePaymentSchema', () => {
  const payment = {
    fromAccountId: '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
    amountCents: 150_000,
    date: '2026-11-05',
    status: 'PAID',
  };

  it('aceita pagamento válido', () => {
    expect(invoicePaymentSchema.safeParse(payment).success).toBe(true);
  });

  it('recusa valor zero e conta que não é UUID', () => {
    expect(invoicePaymentSchema.safeParse({ ...payment, amountCents: 0 }).success).toBe(false);
    expect(invoicePaymentSchema.safeParse({ ...payment, fromAccountId: 'abc' }).success).toBe(
      false,
    );
  });
});

describe('invoiceFilterSchema', () => {
  it('converte unpaid da query string em booleano', () => {
    expect(invoiceFilterSchema.parse({ unpaid: 'true' }).unpaid).toBe(true);
    expect(invoiceFilterSchema.parse({}).unpaid).toBe(false);
    expect(invoiceFilterSchema.safeParse({ unpaid: 'sim' }).success).toBe(false);
  });
});
