import { summarize, type SummaryCategory } from './transaction-summary';

const house: SummaryCategory = {
  id: 'c-house',
  name: 'Moradia',
  color: '#816729',
  icon: 'house',
  parentId: null,
};
const rent: SummaryCategory = { ...house, id: 'c-rent', name: 'Aluguel', parentId: 'c-house' };
const food: SummaryCategory = { ...house, id: 'c-food', name: 'Alimentação', color: '#ff682c' };

describe('summarize', () => {
  it('soma receitas e despesas, separa o previsto e ignora transferências', () => {
    const summary = summarize(
      [
        { type: 'INCOME', status: 'PAID', amountCents: 600_000, category: null },
        { type: 'INCOME', status: 'PLANNED', amountCents: 50_000, category: null },
        { type: 'EXPENSE', status: 'PLANNED', amountCents: 180_000, category: rent },
        { type: 'TRANSFER', status: 'PAID', amountCents: 999_999, category: null },
      ],
      [house, rent],
    );
    expect(summary).toMatchObject({
      incomeCents: 650_000,
      expenseCents: 180_000,
      netCents: 470_000,
      plannedIncomeCents: 50_000,
      plannedExpenseCents: 180_000,
    });
  });

  it('agrupa subcategorias na categoria-mãe e ordena do maior gasto para o menor', () => {
    const summary = summarize(
      [
        { type: 'EXPENSE', status: 'PAID', amountCents: 10_000, category: food },
        { type: 'EXPENSE', status: 'PAID', amountCents: 150_000, category: rent },
        { type: 'EXPENSE', status: 'PAID', amountCents: 20_000, category: house },
      ],
      [house, rent, food],
    );
    expect(summary.expensesByCategory).toEqual([
      expect.objectContaining({ categoryId: 'c-house', name: 'Moradia', totalCents: 170_000 }),
      expect.objectContaining({ categoryId: 'c-food', totalCents: 10_000 }),
    ]);
  });
});
