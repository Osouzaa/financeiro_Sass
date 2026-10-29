import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { TransactionsService } from '../transactions/transactions.service';
import { InvoicesService } from './invoices.service';

const CARD_ID = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const CHECKING_ID = '7a2b3c45-6d7e-4f80-9a1b-2c3d4e5f6a7b';

const invoiceRow = {
  id: 'inv-1',
  referenceMonth: '2026-11',
  closingDate: new Date('2026-10-25T00:00:00.000Z'),
  dueDate: new Date('2026-11-05T00:00:00.000Z'),
  account: {
    id: CARD_ID,
    name: 'Nubank',
    type: 'CREDIT_CARD',
    color: null,
    paymentAccountId: null,
  },
};

function setup() {
  const invoice = { findFirst: jest.fn().mockResolvedValue(invoiceRow), findMany: jest.fn() };
  const transaction = { groupBy: jest.fn().mockResolvedValue([]) };
  const transactions = { createTransfer: jest.fn().mockResolvedValue({ id: 't1' }) };
  const service = new InvoicesService(
    { invoice, transaction } as unknown as PrismaService,
    transactions as unknown as TransactionsService,
  );
  return { service, invoice, transactions };
}

const payment = {
  fromAccountId: CHECKING_ID,
  amountCents: 50_000,
  date: '2026-11-05',
  status: 'PAID' as const,
};

describe('InvoicesService.pay', () => {
  it('vira transferência para o cartão ligada à fatura, com descrição do mês', async () => {
    const { service, transactions } = setup();
    await service.pay('u1', 'inv-1', payment);
    expect(transactions.createTransfer).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        fromAccountId: CHECKING_ID,
        toAccountId: CARD_ID,
        amountCents: 50_000,
        description: 'Pagamento da fatura Nubank (novembro)',
      }),
      'inv-1',
    );
  });

  it('busca a fatura filtrando pelo usuário e responde 404 para a de outra pessoa', async () => {
    const { service, invoice, transactions } = setup();
    invoice.findFirst.mockResolvedValueOnce(null);
    await expect(service.pay('u2', 'inv-1', payment)).rejects.toBeInstanceOf(NotFoundException);
    expect(invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1', userId: 'u2' } }),
    );
    expect(transactions.createTransfer).not.toHaveBeenCalled();
  });

  it('o cartão não paga a própria fatura', async () => {
    const { service } = setup();
    await expect(
      service.pay('u1', 'inv-1', { ...payment, fromAccountId: CARD_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
