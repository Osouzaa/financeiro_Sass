import { BadRequestException, NotFoundException } from '@nestjs/common';
import { addDays, todayIso } from '@financeiro/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { EntryRules } from '../ledger/entry-rules';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import { TransactionsService } from './transactions.service';

const ACCOUNT_ID = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const CATEGORY_ID = '7a2b3c45-6d7e-4f80-9a1b-2c3d4e5f6a7b';

const checking = {
  id: ACCOUNT_ID,
  name: 'Conta Itaú',
  type: 'CHECKING',
  archived: false,
  closingDay: null,
  dueDay: null,
  initialBalanceDate: new Date('2026-01-01T00:00:00.000Z'),
};
const card = { ...checking, name: 'Nubank', type: 'CREDIT_CARD', closingDay: 25, dueDay: 5 };

const row = {
  id: 't1',
  type: 'EXPENSE',
  amount: { toString: () => '45.90' },
  description: 'Mercado',
  notes: null,
  competenceDate: new Date('2026-10-20T00:00:00.000Z'),
  cashDate: null,
  status: 'PAID',
  transferGroupId: null,
  transferDirection: null,
  account: { id: ACCOUNT_ID, name: 'Nubank', type: 'CREDIT_CARD', color: null },
  category: null,
  invoice: null,
};

function setup() {
  const transaction = {
    create: jest.fn().mockResolvedValue({ id: 't1' }),
    createMany: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(row),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
  };
  const account = { findFirst: jest.fn() };
  const category = { findFirst: jest.fn().mockResolvedValue({ type: 'EXPENSE', archived: false }) };
  const invoice = { upsert: jest.fn().mockResolvedValue({ id: 'inv-1' }), deleteMany: jest.fn() };
  const client = { transaction, account, category, invoice };
  const prisma = {
    ...client,
    $transaction: jest.fn((callback: (tx: typeof client) => unknown) => callback(client)),
  };
  return {
    service: new TransactionsService(
      prisma as unknown as PrismaService,
      new EntryRules(prisma as unknown as PrismaService),
      { ensureGenerated: jest.fn() } as unknown as RecurrencesService,
    ),
    ...client,
  };
}

const input = {
  type: 'EXPENSE' as const,
  accountId: ACCOUNT_ID,
  categoryId: CATEGORY_ID,
  amountCents: 4590,
  description: 'Mercado',
  notes: null,
  date: '2026-10-20',
  status: 'PAID' as const,
  installments: 1,
};

describe('TransactionsService.create (parcelado)', () => {
  it('divide o total em parcelas mensais, sobra na primeira, no cartão cada uma numa fatura', async () => {
    const { service, account, transaction, invoice } = setup();
    account.findFirst.mockResolvedValue(card);
    invoice.upsert.mockImplementation(({ create }: { create: { referenceMonth: string } }) =>
      Promise.resolve({ id: `inv-${create.referenceMonth}` }),
    );

    await service.create('u1', { ...input, amountCents: 10_000, installments: 3 });

    // Todas as parcelas vão num createMany só
    const calls = transaction.createMany.mock.calls.flatMap(
      ([arg]: [{ data: Record<string, unknown>[] }]) => arg.data,
    );
    expect(calls.map((data) => data.amount)).toEqual(['33.34', '33.33', '33.33']);
    expect(calls.map((data) => data.installmentNumber)).toEqual([1, 2, 3]);
    expect(calls.every((data) => data.installmentTotal === 3)).toBe(true);
    // Compra em 20/10 com fechamento dia 25: faturas de novembro, dezembro e janeiro
    expect(calls.map((data) => data.invoiceId)).toEqual([
      'inv-2026-11',
      'inv-2026-12',
      'inv-2027-01',
    ]);
  });

  it('receita não pode ser parcelada', async () => {
    const { service, account, category } = setup();
    account.findFirst.mockResolvedValue(checking);
    category.findFirst.mockResolvedValue({ type: 'INCOME', archived: false });
    await expect(
      service.create('u1', { ...input, type: 'INCOME', installments: 2 }),
    ).rejects.toThrow('parceladas');
  });
});

describe('TransactionsService.create', () => {
  it('busca a conta sempre filtrando pelo usuário do token', async () => {
    const { service, account } = setup();
    account.findFirst.mockResolvedValue(checking);
    await service.create('u1', input);
    expect(account.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ACCOUNT_ID, userId: 'u1' } }),
    );
  });

  it('trata conta de outra pessoa como inexistente', async () => {
    const { service, account, transaction } = setup();
    account.findFirst.mockResolvedValue(null);
    await expect(service.create('u1', input)).rejects.toThrow('Conta não encontrada');
    expect(transaction.create).not.toHaveBeenCalled();
  });

  it('recusa categoria de receita numa despesa', async () => {
    const { service, account, category } = setup();
    account.findFirst.mockResolvedValue(checking);
    category.findFirst.mockResolvedValue({ type: 'INCOME', archived: false });
    await expect(service.create('u1', input)).rejects.toThrow('categoria de despesa');
  });

  it('recusa conta arquivada em lançamento novo', async () => {
    const { service, account } = setup();
    account.findFirst.mockResolvedValue({ ...checking, archived: true });
    await expect(service.create('u1', input)).rejects.toThrow('arquivada');
  });

  it('recusa lançamento futuro marcado como realizado', async () => {
    const { service, account } = setup();
    account.findFirst.mockResolvedValue(checking);
    const future = addDays(todayIso(), 5);
    await expect(service.create('u1', { ...input, date: future })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('recusa data anterior ao saldo inicial da conta', async () => {
    const { service, account } = setup();
    account.findFirst.mockResolvedValue(checking);
    await expect(service.create('u1', { ...input, date: '2025-12-31' })).rejects.toThrow(
      '01/01/2026',
    );
  });

  it('compra no cartão vai para a fatura do período, sem data de caixa', async () => {
    const { service, account, invoice, transaction } = setup();
    account.findFirst.mockResolvedValue(card);
    // Comprou no dia 25 (dia do fechamento): cai na fatura que vence em 5 de dezembro
    await service.create('u1', { ...input, date: '2026-10-25', status: 'PLANNED' });

    expect(invoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId_referenceMonth: { accountId: ACCOUNT_ID, referenceMonth: '2026-12' } },
      }),
    );
    expect(transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        invoiceId: 'inv-1',
        cashDate: null,
        status: 'PAID',
        amount: '45.90',
      }),
      select: { id: true },
    });
  });
});

describe('TransactionsService.setStatus', () => {
  it('não permite pagar compra de cartão avulsa (é paga pela fatura)', async () => {
    const { service, transaction } = setup();
    transaction.findFirst.mockResolvedValueOnce({
      type: 'EXPENSE',
      competenceDate: new Date('2026-10-20T00:00:00.000Z'),
      transferGroupId: null,
      account: { type: 'CREDIT_CARD' },
    });
    await expect(service.setStatus('u1', 't1', 'PLANNED')).rejects.toThrow('fatura');
  });
});

describe('TransactionsService.remove', () => {
  it('ao excluir pagamento de cartão, limpa a fatura que ficou na outra ponta', async () => {
    const { service, transaction, invoice } = setup();
    transaction.findFirst.mockResolvedValueOnce({
      type: 'TRANSFER',
      accountId: ACCOUNT_ID,
      categoryId: null,
      invoiceId: null,
      transferGroupId: 'g1',
    });
    transaction.findMany.mockResolvedValueOnce([{ invoiceId: null }, { invoiceId: 'inv-9' }]);
    Object.assign(transaction, { deleteMany: jest.fn() });

    await service.remove('u1', 't-out');
    expect(invoice.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { in: ['inv-9'] } }),
    });
  });

  it('responde 404 para lançamento de outra pessoa', async () => {
    const { service, transaction } = setup();
    transaction.findFirst.mockResolvedValueOnce(null);
    await expect(service.remove('u1', 't1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
