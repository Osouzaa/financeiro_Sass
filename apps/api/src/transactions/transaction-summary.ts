import {
  TransactionStatus,
  TransactionType,
  type CategoryTotalDto,
  type TransactionDto,
  type TransactionSummaryDto,
} from '@financeiro/shared';

export interface SummaryCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parentId: string | null;
}

/**
 * Totais de um conjunto de lançamentos.
 * Transferências só movem dinheiro entre contas, então não contam como receita nem despesa.
 * Subcategorias somam na categoria-mãe, para o gráfico não pulverizar.
 */
export function summarize(
  items: Pick<TransactionDto, 'type' | 'status' | 'amountCents' | 'category'>[],
  categories: SummaryCategory[],
): TransactionSummaryDto {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const byRoot = new Map<string, CategoryTotalDto>();
  const summary = {
    incomeCents: 0,
    expenseCents: 0,
    plannedIncomeCents: 0,
    plannedExpenseCents: 0,
  };

  for (const item of items) {
    const planned = item.status === TransactionStatus.PLANNED;
    if (item.type === TransactionType.INCOME) {
      summary.incomeCents += item.amountCents;
      if (planned) summary.plannedIncomeCents += item.amountCents;
    } else if (item.type === TransactionType.EXPENSE) {
      summary.expenseCents += item.amountCents;
      if (planned) summary.plannedExpenseCents += item.amountCents;

      if (!item.category) continue;
      const root =
        (item.category.parentId && byId.get(item.category.parentId)) ||
        byId.get(item.category.id) ||
        item.category;
      const entry = byRoot.get(root.id) ?? {
        categoryId: root.id,
        name: root.name,
        color: root.color,
        icon: root.icon,
        totalCents: 0,
      };
      entry.totalCents += item.amountCents;
      byRoot.set(root.id, entry);
    }
  }

  return {
    ...summary,
    netCents: summary.incomeCents - summary.expenseCents,
    expensesByCategory: [...byRoot.values()].sort((a, b) => b.totalCents - a.totalCents),
  };
}
