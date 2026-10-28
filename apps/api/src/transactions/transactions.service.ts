import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountType,
  EditScope,
  TransactionStatus,
  TransactionType,
  fromCents,
  installmentDate,
  splitInstallments,
  toCents,
  todayIso,
  type AccountRefDto,
  type TransactionDto,
  type TransactionFilterParsed,
  type TransactionInputParsed,
  type TransactionListDto,
  type TransactionStatus as Status,
  type TransferInputParsed,
} from '@financeiro/shared';
import { fromDbDate, toDbDate } from '../common/db-date';
import type { Prisma } from '../generated/prisma/client';
import { EntryRules, fieldError, type RulesAccount } from '../ledger/entry-rules';
import {
  entryData,
  installmentInvoiceFor,
  paymentInvoiceFor,
  removeEmptyInvoices,
} from '../ledger/invoice-ledger';
import { PrismaService } from '../prisma/prisma.service';
import { RecurrencesService } from '../recurrences/recurrences.service';
import { summarize } from './transaction-summary';

/** Limite de itens por resposta. Um mês de finanças pessoais fica muito abaixo disso. */
const LIST_LIMIT = 1000;

const ACCOUNT_REF = { id: true, name: true, type: true, color: true } as const;

const TRANSACTION_SELECT = {
  id: true,
  type: true,
  amount: true,
  description: true,
  notes: true,
  competenceDate: true,
  cashDate: true,
  status: true,
  transferGroupId: true,
  transferDirection: true,
  installmentGroupId: true,
  installmentNumber: true,
  installmentTotal: true,
  recurrenceId: true,
  account: { select: ACCOUNT_REF },
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
      parentId: true,
      parent: { select: { icon: true } },
    },
  },
  invoice: { select: { referenceMonth: true, dueDate: true } },
} as const satisfies Prisma.TransactionSelect;

type TransactionRow = Prisma.TransactionGetPayload<{ select: typeof TRANSACTION_SELECT }>;

type Scope = (typeof EditScope)[keyof typeof EditScope];

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: EntryRules,
    private readonly recurrences: RecurrencesService,
  ) {}

  async list(userId: string, filter: TransactionFilterParsed): Promise<TransactionListDto> {
    // Recorrências viram lançamentos previstos sob demanda, conforme o período consultado
    await this.recurrences.ensureGenerated(userId, filter.to);

    const where: Prisma.TransactionWhereInput = {
      userId,
      competenceDate: { gte: toDbDate(filter.from), lte: toDbDate(filter.to) },
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q ? { description: { contains: filter.q } } : {}),
      AND: [
        // Sem filtro de conta, cada transferência aparece uma vez (pela ponta que sai)
        filter.accountId
          ? { accountId: filter.accountId }
          : { OR: [{ transferDirection: null }, { transferDirection: 'OUT' }] },
        ...(filter.categoryId
          ? [
              {
                OR: [
                  { categoryId: filter.categoryId },
                  { category: { parentId: filter.categoryId } },
                ],
              },
            ]
          : []),
      ],
    };

    const [rows, categories] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: TRANSACTION_SELECT,
        orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
        take: LIST_LIMIT + 1,
      }),
      this.prisma.category.findMany({
        where: { userId },
        select: { id: true, name: true, color: true, icon: true, parentId: true },
      }),
    ]);

    const items = await this.toDtos(userId, rows.slice(0, LIST_LIMIT));
    return { items, summary: summarize(items, categories), truncated: rows.length > LIST_LIMIT };
  }

  async get(userId: string, id: string): Promise<TransactionDto> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, userId },
      select: TRANSACTION_SELECT,
    });
    if (!row) throw new NotFoundException('Lançamento não encontrado');
    const [dto] = await this.toDtos(userId, [row]);
    return dto!;
  }

  /**
   * Receita ou despesa. Com mais de uma parcela, o total é dividido em centavos
   * (sobra na primeira) e cada parcela cai um mês depois; no cartão, cada uma
   * vai para a fatura seguinte. Devolve a primeira parcela.
   */
  async create(userId: string, input: TransactionInputParsed): Promise<TransactionDto> {
    const account = await this.rules.findAccount(userId, input.accountId, 'accountId');
    await this.rules.assertCategory(userId, input.categoryId, input.type);
    this.rules.assertDates(account, input.date, input.status);
    if (input.installments > 1 && input.type !== TransactionType.EXPENSE) {
      throw fieldError('installments', 'Só despesas podem ser parceladas');
    }

    const id = await this.prisma.$transaction(async (tx) => {
      if (input.installments === 1) {
        const data = await entryData(tx, userId, account, input);
        const created = await tx.transaction.create({
          data: { userId, ...data },
          select: { id: true },
        });
        return created.id;
      }
      return this.createInstallments(tx, userId, account, input);
    });
    return this.get(userId, id);
  }

  /**
   * `this`: só este lançamento (numa recorrência, ele passa a ser editado à mão).
   * `future`: numa compra parcelada, esta e as próximas parcelas recebem descrição,
   * categoria, observação e valor; numa recorrência, a regra muda desta em diante.
   */
  async update(
    userId: string,
    id: string,
    input: TransactionInputParsed,
    scope: Scope = EditScope.THIS,
  ): Promise<TransactionDto> {
    const current = await this.findOwned(userId, id);
    if (current.type === TransactionType.TRANSFER) {
      throw new BadRequestException('Use a edição de transferência para este lançamento');
    }
    // Conta e categoria já usadas continuam valendo mesmo se tiverem sido arquivadas depois
    const account = await this.rules.findAccount(
      userId,
      input.accountId,
      'accountId',
      current.accountId,
    );
    await this.rules.assertCategory(userId, input.categoryId, input.type, current.categoryId);
    this.rules.assertDates(account, input.date, input.status);

    if (scope === EditScope.FUTURE && current.recurrenceId && current.originalDate) {
      await this.recurrences.splitFrom(
        userId,
        { id, recurrenceId: current.recurrenceId, originalDate: fromDbDate(current.originalDate) },
        input,
      );
      return this.get(userId, id);
    }

    if (scope === EditScope.FUTURE && current.installmentGroupId) {
      if (input.accountId !== current.accountId) {
        throw fieldError(
          'accountId',
          'Para trocar a conta de todas as parcelas, exclua a compra e lance de novo',
        );
      }
      if (input.type !== current.type) {
        throw fieldError('type', 'Parcelas continuam sendo despesas');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Parcela no cartão mantém a fatura dela enquanto a data e a conta não mudam
      const keepInvoice =
        current.invoiceId &&
        input.accountId === current.accountId &&
        input.date === fromDbDate(current.competenceDate);
      const data = await entryData(
        tx,
        userId,
        account,
        input,
        keepInvoice ? current.invoiceId! : undefined,
      );
      await tx.transaction.update({
        where: { id },
        data: { ...data, ...(current.recurrenceId ? { detached: true } : {}) },
      });

      if (scope === EditScope.FUTURE && current.installmentGroupId) {
        await tx.transaction.updateMany({
          where: {
            userId,
            installmentGroupId: current.installmentGroupId,
            installmentNumber: { gt: current.installmentNumber ?? 0 },
          },
          data: {
            description: input.description,
            categoryId: input.categoryId,
            notes: input.notes,
            amount: fromCents(input.amountCents),
          },
        });
      }
      await removeEmptyInvoices(tx, [current.invoiceId]);
    });
    return this.get(userId, id);
  }

  /**
   * Transferência entre contas. Para um cartão, é pagamento de fatura: a ponta que
   * entra fica ligada à fatura informada (já validada por quem chama) ou, sem ela,
   * à última fatura fechada até a data do pagamento.
   */
  async createTransfer(
    userId: string,
    input: TransferInputParsed,
    invoiceId?: string,
  ): Promise<TransactionDto> {
    const { from, to } = await this.transferAccounts(userId, input);
    const groupId = randomUUID();
    const outId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      const paidInvoice =
        to.type === AccountType.CREDIT_CARD
          ? (invoiceId ?? (await paymentInvoiceFor(tx, userId, to, input.date)))
          : null;
      await tx.transaction.createMany({
        data: [
          { id: outId, ...this.transferLeg(userId, groupId, from.id, 'OUT', input) },
          {
            id: randomUUID(),
            ...this.transferLeg(userId, groupId, to.id, 'IN', input, paidInvoice),
          },
        ],
      });
    });
    return this.get(userId, outId);
  }

  async updateTransfer(
    userId: string,
    groupId: string,
    input: TransferInputParsed,
  ): Promise<TransactionDto> {
    const legs = await this.prisma.transaction.findMany({
      where: { userId, transferGroupId: groupId, type: TransactionType.TRANSFER },
      select: { id: true, accountId: true, transferDirection: true, invoiceId: true },
    });
    const out = legs.find((leg) => leg.transferDirection === 'OUT');
    const into = legs.find((leg) => leg.transferDirection === 'IN');
    if (!out || !into) throw new NotFoundException('Transferência não encontrada');

    const { from, to } = await this.transferAccounts(userId, input, {
      from: out.accountId,
      to: into.accountId,
    });
    await this.prisma.$transaction(async (tx) => {
      // Mesmo cartão: o pagamento continua na fatura que já pagava
      const paidInvoice =
        to.type !== AccountType.CREDIT_CARD
          ? null
          : to.id === into.accountId && into.invoiceId
            ? into.invoiceId
            : await paymentInvoiceFor(tx, userId, to, input.date);
      await tx.transaction.update({
        where: { id: out.id },
        data: this.transferLeg(userId, groupId, from.id, 'OUT', input),
      });
      await tx.transaction.update({
        where: { id: into.id },
        data: this.transferLeg(userId, groupId, to.id, 'IN', input, paidInvoice),
      });
      if (into.invoiceId !== paidInvoice) await removeEmptyInvoices(tx, [into.invoiceId]);
    });
    return this.get(userId, out.id);
  }

  /** Lançamentos de uma fatura (compras, estornos e pagamentos), do mais recente ao mais antigo. */
  async listByInvoice(userId: string, invoiceId: string): Promise<TransactionDto[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { userId, invoiceId },
      select: TRANSACTION_SELECT,
      orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
      take: LIST_LIMIT,
    });
    return this.toDtos(userId, rows);
  }

  /** Marca como realizado/previsto. Numa transferência, vale para as duas pontas. */
  async setStatus(userId: string, id: string, status: Status): Promise<TransactionDto> {
    const current = await this.prisma.transaction.findFirst({
      where: { id, userId },
      select: {
        type: true,
        competenceDate: true,
        transferGroupId: true,
        account: { select: { type: true } },
      },
    });
    if (!current) throw new NotFoundException('Lançamento não encontrado');
    if (
      current.type !== TransactionType.TRANSFER &&
      current.account.type === AccountType.CREDIT_CARD
    ) {
      throw new BadRequestException('Compras no cartão são pagas junto com a fatura');
    }
    this.rules.assertStatus(fromDbDate(current.competenceDate), status);

    if (current.transferGroupId) {
      await this.prisma.transaction.updateMany({
        where: { userId, transferGroupId: current.transferGroupId },
        data: { status },
      });
    } else {
      await this.prisma.transaction.update({ where: { id }, data: { status } });
    }
    return this.get(userId, id);
  }

  /** `future`: numa compra parcelada, esta e as próximas parcelas; numa recorrência, encerra a partir desta. */
  async remove(userId: string, id: string, scope: Scope = EditScope.THIS): Promise<void> {
    const current = await this.findOwned(userId, id);

    if (scope === EditScope.FUTURE && current.recurrenceId && current.originalDate) {
      await this.recurrences.endFrom(userId, {
        id,
        recurrenceId: current.recurrenceId,
        originalDate: fromDbDate(current.originalDate),
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      let where: Prisma.TransactionWhereInput = { id, userId };
      if (current.transferGroupId) {
        where = { userId, transferGroupId: current.transferGroupId };
      } else if (scope === EditScope.FUTURE && current.installmentGroupId) {
        where = {
          userId,
          installmentGroupId: current.installmentGroupId,
          installmentNumber: { gte: current.installmentNumber ?? 1 },
        };
      }
      // A fatura pode estar em qualquer uma das linhas (ponta do cartão, outras parcelas)
      const rows = await tx.transaction.findMany({ where, select: { invoiceId: true } });
      await tx.transaction.deleteMany({ where });
      await removeEmptyInvoices(
        tx,
        rows.map((row) => row.invoiceId),
      );
    });
  }

  private async createInstallments(
    tx: Prisma.TransactionClient,
    userId: string,
    account: RulesAccount,
    input: TransactionInputParsed,
  ): Promise<string> {
    const isCard = account.type === AccountType.CREDIT_CARD;
    const parts = splitInstallments(input.amountCents, input.installments);
    const groupId = randomUUID();
    const today = todayIso();
    const rows: Prisma.TransactionCreateManyInput[] = [];

    for (const [index, amountCents] of parts.entries()) {
      const date = installmentDate(input.date, index);
      // Só a primeira segue o status escolhido; as seguintes ficam previstas até a data chegar
      const status =
        index === 0 || (date <= today && input.status === TransactionStatus.PAID)
          ? input.status
          : TransactionStatus.PLANNED;
      const invoiceId = isCard
        ? await installmentInvoiceFor(tx, userId, account, input.date, index)
        : undefined;
      const data = await entryData(
        tx,
        userId,
        account,
        { ...input, amountCents, date, status },
        invoiceId,
      );
      rows.push({
        id: randomUUID(),
        userId,
        ...data,
        installmentGroupId: groupId,
        installmentNumber: index + 1,
        installmentTotal: parts.length,
      });
    }
    // Em lotes, sem uma ida ao banco por parcela: o SQL Server aceita até 2.100 parâmetros por comando
    for (let start = 0; start < rows.length; start += 100) {
      await tx.transaction.createMany({ data: rows.slice(start, start + 100) });
    }
    return rows[0]!.id!;
  }

  private async findOwned(userId: string, id: string) {
    const row = await this.prisma.transaction.findFirst({
      where: { id, userId },
      select: {
        type: true,
        accountId: true,
        categoryId: true,
        invoiceId: true,
        competenceDate: true,
        transferGroupId: true,
        installmentGroupId: true,
        installmentNumber: true,
        recurrenceId: true,
        originalDate: true,
      },
    });
    if (!row) throw new NotFoundException('Lançamento não encontrado');
    return row;
  }

  private async transferAccounts(
    userId: string,
    input: TransferInputParsed,
    keep: { from?: string; to?: string } = {},
  ): Promise<{ from: RulesAccount; to: RulesAccount }> {
    const [from, to] = await Promise.all([
      this.rules.findAccount(userId, input.fromAccountId, 'fromAccountId', keep.from),
      this.rules.findAccount(userId, input.toAccountId, 'toAccountId', keep.to),
    ]);
    if (from.type === AccountType.CREDIT_CARD) {
      throw fieldError(
        'fromAccountId',
        'Transferências saem de conta corrente ou carteira. Compras no cartão são despesas.',
      );
    }
    this.rules.assertAfterInitialBalance(from, input.date);
    this.rules.assertAfterInitialBalance(to, input.date);
    this.rules.assertStatus(input.date, input.status);
    return { from, to };
  }

  private transferLeg(
    userId: string,
    groupId: string,
    accountId: string,
    direction: 'IN' | 'OUT',
    input: TransferInputParsed,
    invoiceId: string | null = null,
  ) {
    return {
      userId,
      accountId,
      categoryId: null,
      type: TransactionType.TRANSFER,
      amount: fromCents(input.amountCents),
      description: input.description,
      notes: input.notes,
      competenceDate: toDbDate(input.date),
      cashDate: toDbDate(input.date),
      status: input.status,
      invoiceId,
      transferGroupId: groupId,
      transferDirection: direction,
    };
  }

  private async toDtos(userId: string, rows: TransactionRow[]): Promise<TransactionDto[]> {
    const groupIds = [
      ...new Set(rows.map((row) => row.transferGroupId).filter((id): id is string => !!id)),
    ];
    const legs = groupIds.length
      ? await this.prisma.transaction.findMany({
          where: { userId, transferGroupId: { in: groupIds } },
          select: { id: true, transferGroupId: true, account: { select: ACCOUNT_REF } },
        })
      : [];

    return rows.map((row) => {
      const counterpart = row.transferGroupId
        ? legs.find((leg) => leg.transferGroupId === row.transferGroupId && leg.id !== row.id)
        : undefined;
      return this.toDto(row, counterpart?.account ?? null);
    });
  }

  private toDto(row: TransactionRow, counterpart: AccountRefRow | null): TransactionDto {
    return {
      id: row.id,
      type: row.type as TransactionDto['type'],
      amountCents: toCents(row.amount.toString()),
      description: row.description,
      notes: row.notes,
      date: fromDbDate(row.competenceDate),
      cashDate: row.cashDate ? fromDbDate(row.cashDate) : null,
      status: row.status as TransactionDto['status'],
      account: toAccountRef(row.account),
      category: row.category
        ? {
            id: row.category.id,
            name: row.category.name,
            color: row.category.color,
            // Subcategorias usam o ícone da categoria principal
            icon: row.category.icon ?? row.category.parent?.icon ?? null,
            parentId: row.category.parentId,
          }
        : null,
      transfer: row.transferGroupId
        ? {
            groupId: row.transferGroupId,
            direction: row.transferDirection === 'IN' ? 'IN' : 'OUT',
            counterpart: counterpart ? toAccountRef(counterpart) : null,
          }
        : null,
      invoice: row.invoice
        ? { referenceMonth: row.invoice.referenceMonth, dueDate: fromDbDate(row.invoice.dueDate) }
        : null,
      installment:
        row.installmentGroupId && row.installmentNumber && row.installmentTotal
          ? {
              groupId: row.installmentGroupId,
              number: row.installmentNumber,
              total: row.installmentTotal,
            }
          : null,
      recurrenceId: row.recurrenceId,
    };
  }
}

type AccountRefRow = { id: string; name: string; type: string; color: string | null };

const toAccountRef = (account: AccountRefRow): AccountRefDto => ({
  ...account,
  type: account.type as AccountRefDto['type'],
});
