import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CategoryType,
  TransactionStatus,
  TransactionType,
  fromCents,
  monthBounds,
  toCents,
  type BudgetCopyInput,
  type BudgetInputParsed,
  type BudgetMonthDto,
  type CategoryRefDto,
} from '@financeiro/shared';
import { toDbDate } from '../common/db-date';
import { fieldError } from '../ledger/entry-rules';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecurrencesService } from '../recurrences/recurrences.service';

type Usage = { spentCents: number; plannedCents: number };

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurrences: RecurrencesService,
    private readonly plans: PlansService,
  ) {}

  /**
   * Orçamento do mês: limite por categoria principal e quanto já foi consumido pela
   * data da compra (competência). Subcategorias somam na principal. No cartão, a
   * compra conta como realizada no dia em que foi feita.
   */
  async month(userId: string, month: string): Promise<BudgetMonthDto> {
    const { from, to } = monthBounds(month);
    // Recorrências do mês viram previstos antes da soma
    await this.recurrences.ensureGenerated(userId, to);

    const [budgets, categories, groups, user] = await Promise.all([
      this.prisma.budget.findMany({
        where: { userId, month },
        select: { id: true, categoryId: true, limitAmount: true },
      }),
      this.prisma.category.findMany({
        where: { userId, type: CategoryType.EXPENSE },
        select: { id: true, name: true, color: true, icon: true, parentId: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['categoryId', 'status'],
        where: {
          userId,
          type: TransactionType.EXPENSE,
          competenceDate: { gte: toDbDate(from), lte: toDbDate(to) },
        },
        _sum: { amount: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { alertBudget: true, alertBudgetPercent: true },
      }),
    ]);

    const byId = new Map(categories.map((category) => [category.id, category]));
    const rootOf = (id: string) => byId.get(id)?.parentId ?? id;
    const usage = new Map<string, Usage>();
    for (const group of groups) {
      if (!group.categoryId) continue;
      const root = rootOf(group.categoryId);
      const entry = usage.get(root) ?? { spentCents: 0, plannedCents: 0 };
      const cents = toCents(group._sum.amount?.toString() ?? '0');
      if (group.status === TransactionStatus.PLANNED) entry.plannedCents += cents;
      else entry.spentCents += cents;
      usage.set(root, entry);
    }

    const ref = (id: string): CategoryRefDto => {
      const category = byId.get(id);
      return {
        id,
        name: category?.name ?? 'Categoria removida',
        color: category?.color ?? null,
        icon: category?.icon ?? null,
        parentId: null,
      };
    };

    const items = budgets
      .map((budget) => {
        const { spentCents, plannedCents } = usage.get(budget.categoryId) ?? {
          spentCents: 0,
          plannedCents: 0,
        };
        return {
          id: budget.id,
          category: ref(budget.categoryId),
          limitCents: toCents(budget.limitAmount.toString()),
          spentCents,
          plannedCents,
          usedCents: spentCents + plannedCents,
        };
      })
      // As mais apertadas primeiro
      .sort((a, b) => b.usedCents / b.limitCents - a.usedCents / a.limitCents);

    const budgeted = new Set(budgets.map((budget) => budget.categoryId));
    const unbudgeted = [...usage.entries()]
      .filter(([id, entry]) => !budgeted.has(id) && entry.spentCents + entry.plannedCents > 0)
      .map(([id, entry]) => ({
        category: ref(id),
        usedCents: entry.spentCents + entry.plannedCents,
      }))
      .sort((a, b) => b.usedCents - a.usedCents);

    return {
      month,
      alertPercent: user?.alertBudget ? user.alertBudgetPercent : null,
      items,
      unbudgeted,
      totals: {
        limitCents: items.reduce((sum, item) => sum + item.limitCents, 0),
        spentCents: items.reduce((sum, item) => sum + item.spentCents, 0),
        usedCents: items.reduce((sum, item) => sum + item.usedCents, 0),
      },
    };
  }

  /** Define (ou troca) o limite de uma categoria principal de despesa no mês. */
  async upsert(userId: string, input: BudgetInputParsed): Promise<BudgetMonthDto> {
    const category = await this.prisma.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { type: true, parentId: true, archived: true },
    });
    if (!category) throw fieldError('categoryId', 'Categoria não encontrada');
    if (category.type !== CategoryType.EXPENSE) {
      throw fieldError('categoryId', 'Orçamento vale só para categorias de despesa');
    }
    if (category.parentId) {
      throw fieldError(
        'categoryId',
        'Defina o limite na categoria principal; as subcategorias somam nela',
      );
    }
    if (category.archived) throw fieldError('categoryId', 'Esta categoria está arquivada');

    // Só um limite novo conta; trocar o valor de um existente não
    const [exists, inMonth] = await Promise.all([
      this.prisma.budget.findUnique({
        where: {
          userId_categoryId_month: { userId, categoryId: input.categoryId, month: input.month },
        },
        select: { id: true },
      }),
      this.prisma.budget.count({ where: { userId, month: input.month } }),
    ]);
    if (!exists) await this.plans.assertWithin(userId, 'maxBudgets', inMonth);

    await this.prisma.budget.upsert({
      where: {
        userId_categoryId_month: { userId, categoryId: input.categoryId, month: input.month },
      },
      create: {
        userId,
        categoryId: input.categoryId,
        month: input.month,
        limitAmount: fromCents(input.limitCents),
      },
      update: { limitAmount: fromCents(input.limitCents) },
    });
    return this.month(userId, input.month);
  }

  async remove(userId: string, id: string): Promise<void> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!budget) throw new NotFoundException('Limite não encontrado');
    await this.prisma.budget.delete({ where: { id } });
  }

  /** Copia os limites de outro mês, sem mexer nos que o destino já tem. */
  async copy(userId: string, input: BudgetCopyInput): Promise<BudgetMonthDto> {
    const [source, target] = await Promise.all([
      this.prisma.budget.findMany({
        where: { userId, month: input.from, category: { archived: false } },
        select: { categoryId: true, limitAmount: true },
      }),
      this.prisma.budget.findMany({
        where: { userId, month: input.to },
        select: { categoryId: true },
      }),
    ]);
    const taken = new Set(target.map((budget) => budget.categoryId));
    const missing = source.filter((budget) => !taken.has(budget.categoryId));
    if (missing.length) {
      await this.plans.assertWithin(userId, 'maxBudgets', target.length, missing.length);
      await this.prisma.budget.createMany({
        data: missing.map((budget) => ({
          userId,
          categoryId: budget.categoryId,
          month: input.to,
          limitAmount: budget.limitAmount,
        })),
      });
    }
    return this.month(userId, input.to);
  }
}
