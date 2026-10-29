import { computeBalance, type TransactionTotal } from './balances';

const total = (partial: Partial<TransactionTotal>): TransactionTotal => ({
  accountId: 'a1',
  type: 'EXPENSE',
  status: 'PAID',
  transferDirection: null,
  amount: '0',
  ...partial,
});

describe('computeBalance', () => {
  const checking = { type: 'CHECKING', initialBalanceCents: 100_000, creditLimitCents: null };

  it('conta corrente: saldo inicial + receitas − despesas realizadas', () => {
    const result = computeBalance(checking, [
      total({ type: 'INCOME', amount: '5000.00' }),
      total({ type: 'EXPENSE', amount: '1200.50' }),
    ]);
    expect(result).toEqual({
      balanceCents: 100_000 + 500_000 - 120_050,
      availableLimitCents: null,
    });
  });

  it('conta corrente: lançamentos previstos não mexem no saldo atual', () => {
    const result = computeBalance(checking, [
      total({ type: 'EXPENSE', status: 'PLANNED', amount: '999.99' }),
    ]);
    expect(result.balanceCents).toBe(100_000);
  });

  it('conta corrente: transferências entram e saem conforme a direção', () => {
    const result = computeBalance(checking, [
      total({ type: 'TRANSFER', transferDirection: 'IN', amount: '300.00' }),
      total({ type: 'TRANSFER', transferDirection: 'OUT', amount: '100.00' }),
    ]);
    expect(result.balanceCents).toBe(100_000 + 30_000 - 10_000);
  });

  it('cartão: compras somam na dívida; estornos e pagamentos abatem; limite disponível', () => {
    const card = { type: 'CREDIT_CARD', initialBalanceCents: 0, creditLimitCents: 500_000 };
    const result = computeBalance(card, [
      total({ type: 'EXPENSE', status: 'PLANNED', amount: '2000.00' }),
      total({ type: 'INCOME', amount: '150.00' }),
      total({ type: 'TRANSFER', transferDirection: 'IN', amount: '1000.00' }),
    ]);
    expect(result).toEqual({ balanceCents: 85_000, availableLimitCents: 415_000 });
  });

  it('cartão: pagamento ainda previsto não abate a dívida', () => {
    const card = { type: 'CREDIT_CARD', initialBalanceCents: 0, creditLimitCents: 500_000 };
    const result = computeBalance(card, [
      total({ type: 'EXPENSE', amount: '2000.00' }),
      total({ type: 'TRANSFER', status: 'PLANNED', transferDirection: 'IN', amount: '2000.00' }),
    ]);
    expect(result.balanceCents).toBe(200_000);
  });
});
