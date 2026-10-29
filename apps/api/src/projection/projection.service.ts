import { Injectable } from '@nestjs/common';
import {
  AccountType,
  TransactionStatus,
  TransactionType,
  addDays,
  toCents,
  todayIso,
  type ProjectionDto,
  type ProjectionEventDto,
  type ProjectionQuery,
} from '@financeiro/shared';
import { AccountsService } from '../accounts/accounts.service';
import { fromDbDate, toDbDate } from '../common/db-date';
import { InvoicesService } from '../invoices/invoices.service';
import { fieldError } from '../ledger/entry-rules';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecurrencesService } from '../recurrences/recurrences.service';
import { buildProjection } from './projection-math';

/** Movimentos devolvidos para a lista da tela; o gráfico usa todos. */
const EVENTS_LIMIT = 300;

@Injectable()
export class ProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly invoices: InvoicesService,
    private readonly recurrences: RecurrencesService,
    private readonly plans: PlansService,
  ) {}

  /**
   * Saldo previsto das contas correntes e carteiras. Parte do saldo atual e aplica:
   * - lançamentos previstos (inclusive atrasados, que entram como hoje);
   * - faturas de cartão com valor a pagar, no vencimento, descontado o que já está
   *   agendado (o agendamento já é um lançamento previsto na conta).
   * Com `accountId`, só aquela conta e as faturas dos cartões que ela paga.
   */
  async project(userId: string, query: ProjectionQuery): Promise<ProjectionDto> {
    const today = todayIso();
    await this.plans.assertProjectionDays(userId, query.days);
    const until = addDays(today, query.days);
    await this.recurrences.ensureGenerated(userId, until);

    const accounts = await this.accounts.list(userId);
    const cash = accounts.filter(
      (account) =>
        account.type !== AccountType.CREDIT_CARD &&
        (!query.accountId || account.id === query.accountId),
    );
    // Conta de outra pessoa (ou um cartão) não aparece na lista do usuário
    if (query.accountId && cash.length === 0) {
      throw fieldError('accountId', 'Escolha uma conta corrente ou carteira');
    }
    const cashIds = new Set(cash.map((account) => account.id));
    const startBalanceCents = cash.reduce((sum, account) => sum + account.balanceCents, 0);

    const [planned, invoices] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          accountId: { in: [...cashIds] },
          status: TransactionStatus.PLANNED,
          cashDate: { lte: toDbDate(until) },
        },
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          cashDate: true,
          transferGroupId: true,
          transferDirection: true,
          account: { select: { name: true } },
        },
        orderBy: { cashDate: 'asc' },
      }),
      this.invoices.list(userId, { unpaid: true }),
    ]);

    // Transferência entre duas contas consideradas não muda o total: as pontas se anulam
    const legsByGroup = new Map<string, number>();
    for (const row of planned) {
      if (row.transferGroupId) {
        legsByGroup.set(row.transferGroupId, (legsByGroup.get(row.transferGroupId) ?? 0) + 1);
      }
    }

    const events: Omit<ProjectionEventDto, 'overdue'>[] = [];
    for (const row of planned) {
      if (!row.cashDate) continue;
      if (row.transferGroupId && legsByGroup.get(row.transferGroupId) === 2) continue;
      const cents = toCents(row.amount.toString());
      const incoming =
        row.type === TransactionType.INCOME ||
        (row.type === TransactionType.TRANSFER && row.transferDirection === 'IN');
      events.push({
        date: fromDbDate(row.cashDate),
        description: row.description,
        amountCents: incoming ? cents : -cents,
        kind: 'transaction',
        accountName: row.account.name,
      });
    }

    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
    for (const invoice of invoices) {
      const due = invoice.remainingCents - invoice.scheduledCents;
      if (due <= 0 || invoice.dueDate > until) continue;
      if (query.accountId && invoice.paymentAccountId !== query.accountId) continue;
      events.push({
        date: invoice.dueDate,
        description: `Fatura ${invoice.account.name}`,
        amountCents: -due,
        kind: 'invoice',
        accountName:
          (invoice.paymentAccountId && accountNames.get(invoice.paymentAccountId)) ||
          invoice.account.name,
      });
    }

    const projection = buildProjection(startBalanceCents, today, until, events);
    return { ...projection, events: projection.events.slice(0, EVENTS_LIMIT) };
  }
}
