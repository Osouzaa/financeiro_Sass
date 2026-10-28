import { describe, expect, it } from 'vitest';
import {
  MAX_AMOUNT_CENTS,
  transactionFilterSchema,
  transactionInputSchema,
  transferInputSchema,
} from './transaction';

const accountId = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const otherId = '7a2b3c45-6d7e-4f80-9a1b-2c3d4e5f6a7b';

const base = {
  type: 'EXPENSE',
  accountId,
  categoryId: otherId,
  amountCents: 4590,
  description: '  Mercado  ',
  date: '2026-10-28',
  status: 'PAID',
};

describe('transactionInputSchema', () => {
  it('aceita despesa válida e limpa espaços e observação vazia', () => {
    const parsed = transactionInputSchema.parse({ ...base, notes: '   ' });
    expect(parsed).toMatchObject({ description: 'Mercado', notes: null });
  });

  it('recusa valor zero, negativo, fracionado ou acima do limite', () => {
    for (const amountCents of [0, -100, 10.5, MAX_AMOUNT_CENTS + 1]) {
      expect(transactionInputSchema.safeParse({ ...base, amountCents }).success).toBe(false);
    }
  });

  it('não aceita transferência como tipo de lançamento comum', () => {
    expect(transactionInputSchema.safeParse({ ...base, type: 'TRANSFER' }).success).toBe(false);
  });

  it('recusa ids que não são UUID', () => {
    const result = transactionInputSchema.safeParse({ ...base, accountId: "1' OR '1'='1" });
    expect(result.error?.issues[0]?.path).toEqual(['accountId']);
  });
});

describe('transferInputSchema', () => {
  const transfer = {
    fromAccountId: accountId,
    toAccountId: otherId,
    amountCents: 10_000,
    description: 'Reserva',
    date: '2026-10-28',
    status: 'PAID',
  };

  it('aceita transferência entre contas diferentes', () => {
    expect(transferInputSchema.safeParse(transfer).success).toBe(true);
  });

  it('recusa origem igual ao destino', () => {
    const result = transferInputSchema.safeParse({ ...transfer, toAccountId: accountId });
    expect(result.error?.issues[0]?.path).toEqual(['toAccountId']);
  });
});

describe('transactionFilterSchema', () => {
  it('aceita um mês e descarta busca vazia', () => {
    const parsed = transactionFilterSchema.parse({ from: '2026-10-01', to: '2026-10-31', q: ' ' });
    expect(parsed.q).toBeUndefined();
  });

  it('recusa período invertido ou maior que um ano', () => {
    expect(
      transactionFilterSchema.safeParse({ from: '2026-10-31', to: '2026-10-01' }).success,
    ).toBe(false);
    expect(
      transactionFilterSchema.safeParse({ from: '2025-01-01', to: '2026-10-01' }).success,
    ).toBe(false);
  });
});
