import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { toCents } from '@financeiro/shared';
import { verifyPassword } from '../auth/password';
import { BillingService } from '../billing/billing.service';
import { fromDbDate } from '../common/db-date';
import { PrismaService } from '../prisma/prisma.service';

const money = (value: { toString(): string }) => toCents(value.toString()) / 100;
const day = (value: Date | null) => (value ? fromDbDate(value) : null);

/**
 * Direitos do titular (LGPD): levar os próprios dados (portabilidade) e excluir
 * a conta. Os dois exigem a sessão do dono; excluir exige também a senha.
 */
@Injectable()
export class AccountDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  /** Tudo o que o sistema guarda da pessoa, em JSON legível. */
  async export(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        createdAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
        cpf: { select: { cpf: true } },
        phone: { select: { phone: true, whatsappOptIn: true, optInAt: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const [accounts, categories, transactions, recurrences, budgets] = await Promise.all([
      this.prisma.account.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      this.prisma.category.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { competenceDate: 'asc' },
      }),
      this.prisma.recurrence.findMany({ where: { userId } }),
      this.prisma.budget.findMany({ where: { userId }, orderBy: { month: 'asc' } }),
    ]);

    const accountName = new Map(accounts.map((account) => [account.id, account.name]));
    const categoryName = new Map(categories.map((category) => [category.id, category.name]));

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        name: user.name,
        email: user.email,
        cpf: user.cpf?.cpf ?? null,
        phone: user.phone?.phone ?? null,
        whatsappOptIn: user.phone?.whatsappOptIn ?? false,
        createdAt: user.createdAt.toISOString(),
        termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
        termsVersion: user.termsVersion,
      },
      accounts: accounts.map((account) => ({
        name: account.name,
        type: account.type,
        initialBalance: money(account.initialBalance),
        initialBalanceDate: day(account.initialBalanceDate),
        closingDay: account.closingDay,
        dueDay: account.dueDay,
        creditLimit: account.creditLimit ? money(account.creditLimit) : null,
        archived: account.archived,
      })),
      categories: categories.map((category) => ({
        name: category.name,
        type: category.type,
        parent: category.parentId ? (categoryName.get(category.parentId) ?? null) : null,
        archived: category.archived,
      })),
      transactions: transactions.map((transaction) => ({
        date: day(transaction.competenceDate),
        cashDate: day(transaction.cashDate),
        type: transaction.type,
        status: transaction.status,
        amount: money(transaction.amount),
        description: transaction.description,
        notes: transaction.notes,
        account: accountName.get(transaction.accountId) ?? null,
        category: transaction.categoryId
          ? (categoryName.get(transaction.categoryId) ?? null)
          : null,
        transferDirection: transaction.transferDirection,
        installment: transaction.installmentNumber
          ? `${transaction.installmentNumber}/${transaction.installmentTotal}`
          : null,
      })),
      recurrences: recurrences.map((recurrence) => ({
        description: recurrence.description,
        type: recurrence.type,
        amount: money(recurrence.amount),
        frequency: recurrence.frequency,
        startDate: day(recurrence.startDate),
        endDate: day(recurrence.endDate),
        account: accountName.get(recurrence.accountId) ?? null,
        category: recurrence.categoryId ? (categoryName.get(recurrence.categoryId) ?? null) : null,
      })),
      budgets: budgets.map((budget) => ({
        month: budget.month,
        category: categoryName.get(budget.categoryId) ?? null,
        limit: money(budget.limitAmount),
      })),
    };
  }

  /**
   * Apaga a conta e todos os dados, em ordem (o SQL Server não tem cascata entre
   * essas tabelas). Sessões, CPF, telefone e assinatura saem junto com o usuário.
   */
  async delete(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new BadRequestException({
        message: 'Senha incorreta',
        fields: { password: ['Senha incorreta'] },
      });
    }

    // Sem cobrança fantasma: a assinatura no Mercado Pago é cancelada antes de apagar a conta
    await this.billing.cancelQuietly(userId);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.transaction.deleteMany({ where: { userId } });
        await tx.budget.deleteMany({ where: { userId } });
        await tx.recurrence.deleteMany({ where: { userId } });
        await tx.invoice.deleteMany({ where: { userId } });
        await tx.account.updateMany({ where: { userId }, data: { paymentAccountId: null } });
        await tx.account.deleteMany({ where: { userId } });
        await tx.category.deleteMany({ where: { userId, NOT: { parentId: null } } });
        await tx.category.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      },
      { timeout: 60_000 },
    );
  }
}
