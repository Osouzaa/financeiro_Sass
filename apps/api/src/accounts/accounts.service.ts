import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountType,
  fromCents,
  toCents,
  type AccountDto,
  type AccountInputParsed,
} from '@financeiro/shared';
import { fromDbDate, toDbDate } from '../common/db-date';
import { PrismaService } from '../prisma/prisma.service';
import { computeBalance, type TransactionTotal } from './balances';

const ACCOUNT_SELECT = {
  id: true,
  name: true,
  type: true,
  color: true,
  initialBalance: true,
  initialBalanceDate: true,
  archived: true,
  closingDay: true,
  dueDay: true,
  creditLimit: true,
  paymentAccountId: true,
} as const;

type AccountRow = {
  id: string;
  name: string;
  type: string;
  color: string | null;
  initialBalance: { toString(): string };
  initialBalanceDate: Date;
  archived: boolean;
  closingDay: number | null;
  dueDay: number | null;
  creditLimit: { toString(): string } | null;
  paymentAccountId: string | null;
};

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, includeArchived = false): Promise<AccountDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, ...(includeArchived ? {} : { archived: false }) },
      select: ACCOUNT_SELECT,
      orderBy: [{ archived: 'asc' }, { name: 'asc' }],
    });
    const totals = await this.totalsByAccount(userId);
    return accounts.map((account) => this.toDto(account, totals.get(account.id) ?? []));
  }

  async get(userId: string, id: string): Promise<AccountDto> {
    const account = await this.findOwned(userId, id);
    const totals = await this.totalsByAccount(userId, id);
    return this.toDto(account, totals.get(id) ?? []);
  }

  async create(userId: string, input: AccountInputParsed): Promise<AccountDto> {
    await this.assertPaymentAccount(userId, input);
    const created = await this.prisma.account.create({
      data: { userId, ...this.toData(input) },
      select: { id: true },
    });
    return this.get(userId, created.id);
  }

  async update(userId: string, id: string, input: AccountInputParsed): Promise<AccountDto> {
    const current = await this.findOwned(userId, id);
    if (input.paymentAccountId === id) {
      throw new BadRequestException({
        message: 'O cartão não pode ser pago por ele mesmo',
        fields: { paymentAccountId: ['Escolha uma conta corrente ou carteira'] },
      });
    }
    await this.assertPaymentAccount(userId, input);

    if (current.type !== input.type && (await this.hasMovements(id))) {
      throw new ConflictException(
        'Não é possível mudar o tipo de uma conta que já tem lançamentos',
      );
    }

    await this.prisma.account.update({ where: { id }, data: this.toData(input) });
    return this.get(userId, id);
  }

  async setArchived(userId: string, id: string, archived: boolean): Promise<AccountDto> {
    await this.findOwned(userId, id);
    await this.prisma.account.update({ where: { id }, data: { archived } });
    return this.get(userId, id);
  }

  /** Exclui só contas sem movimentação; as demais devem ser arquivadas. */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    if (await this.hasMovements(id)) {
      throw new ConflictException(
        'Esta conta tem lançamentos e não pode ser excluída. Arquive-a para escondê-la.',
      );
    }
    const usedAsPayment = await this.prisma.account.count({ where: { paymentAccountId: id } });
    if (usedAsPayment > 0) {
      throw new ConflictException(
        'Esta conta paga a fatura de um cartão. Troque a conta de pagamento do cartão antes.',
      );
    }
    await this.prisma.account.delete({ where: { id } });
  }

  private async findOwned(userId: string, id: string): Promise<AccountRow> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
      select: ACCOUNT_SELECT,
    });
    if (!account) throw new NotFoundException('Conta não encontrada');
    return account;
  }

  private async assertPaymentAccount(userId: string, input: AccountInputParsed): Promise<void> {
    if (!input.paymentAccountId) return;
    const payer = await this.prisma.account.findFirst({
      where: { id: input.paymentAccountId, userId },
      select: { type: true },
    });
    if (!payer || payer.type === AccountType.CREDIT_CARD) {
      throw new BadRequestException({
        message: 'Conta de pagamento inválida',
        fields: { paymentAccountId: ['Escolha uma conta corrente ou carteira'] },
      });
    }
  }

  private async hasMovements(accountId: string): Promise<boolean> {
    const [transactions, invoices, recurrences] = await Promise.all([
      this.prisma.transaction.count({ where: { accountId } }),
      this.prisma.invoice.count({ where: { accountId } }),
      this.prisma.recurrence.count({ where: { accountId } }),
    ]);
    return transactions + invoices + recurrences > 0;
  }

  private async totalsByAccount(
    userId: string,
    accountId?: string,
  ): Promise<Map<string, TransactionTotal[]>> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type', 'status', 'transferDirection'],
      where: { userId, ...(accountId ? { accountId } : {}) },
      _sum: { amount: true },
    });
    const map = new Map<string, TransactionTotal[]>();
    for (const group of groups) {
      const list = map.get(group.accountId) ?? [];
      list.push({
        accountId: group.accountId,
        type: group.type,
        status: group.status,
        transferDirection: group.transferDirection,
        amount: group._sum.amount?.toString() ?? '0',
      });
      map.set(group.accountId, list);
    }
    return map;
  }

  private toData(input: AccountInputParsed) {
    return {
      name: input.name,
      type: input.type,
      color: input.color ?? null,
      initialBalance: fromCents(input.initialBalanceCents),
      initialBalanceDate: toDbDate(input.initialBalanceDate),
      closingDay: input.closingDay ?? null,
      dueDay: input.dueDay ?? null,
      creditLimit: input.creditLimitCents == null ? null : fromCents(input.creditLimitCents),
      paymentAccountId: input.paymentAccountId ?? null,
    };
  }

  private toDto(account: AccountRow, totals: TransactionTotal[]): AccountDto {
    const initialBalanceCents = toCents(account.initialBalance.toString());
    const creditLimitCents = account.creditLimit ? toCents(account.creditLimit.toString()) : null;
    const { balanceCents, availableLimitCents } = computeBalance(
      { type: account.type, initialBalanceCents, creditLimitCents },
      totals,
    );
    return {
      id: account.id,
      name: account.name,
      type: account.type as AccountDto['type'],
      color: account.color,
      initialBalanceCents,
      initialBalanceDate: fromDbDate(account.initialBalanceDate),
      archived: account.archived,
      balanceCents,
      closingDay: account.closingDay,
      dueDay: account.dueDay,
      creditLimitCents,
      availableLimitCents,
      paymentAccountId: account.paymentAccountId,
    };
  }
}
