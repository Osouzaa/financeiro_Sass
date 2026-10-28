import { Injectable, NotFoundException } from '@nestjs/common';
import {
  RecurrenceFrequency,
  TransactionStatus,
  addDays,
  addMonths,
  formatYearMonth,
  fromCents,
  monthBounds,
  monthlyEquivalent,
  nextOccurrence,
  parseIsoDate,
  recurrenceDates,
  toCents,
  todayIso,
  type RecurrenceDto,
  type RecurrenceInputParsed,
} from '@financeiro/shared';
import { fromDbDate, toDbDate } from '../common/db-date';
import type { Prisma } from '../generated/prisma/client';
import { ACCOUNT_RULES, EntryRules } from '../ledger/entry-rules';
import { entryData, removeEmptyInvoices } from '../ledger/invoice-ledger';
import { PrismaService } from '../prisma/prisma.service';

/** Lançamentos previstos são gerados até o fim do mês daqui a 12 meses (base da projeção). */
const HORIZON_MONTHS = 12;
/** Navegar muito para o futuro estende a geração, mas nunca além de 5 anos. */
const MAX_HORIZON_MONTHS = 60;

const RECURRENCE_SELECT = {
  id: true,
  type: true,
  amount: true,
  description: true,
  frequency: true,
  startDate: true,
  endDate: true,
  generatedUntil: true,
  accountId: true,
  categoryId: true,
  account: { select: { id: true, name: true, type: true, color: true } },
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
} as const satisfies Prisma.RecurrenceSelect;

type RecurrenceRow = Prisma.RecurrenceGetPayload<{ select: typeof RECURRENCE_SELECT }>;
type Tx = Prisma.TransactionClient;

/** Ocorrência que o usuário editou ou apagou "desta em diante". */
export interface OccurrenceRef {
  id: string;
  recurrenceId: string;
  /** Data prevista pela recorrência (antes de qualquer edição). */
  originalDate: string;
}

export interface OccurrenceValues {
  accountId: string;
  categoryId: string;
  type: 'INCOME' | 'EXPENSE';
  amountCents: number;
  description: string;
  notes: string | null;
  date: string;
  status: TransactionStatus;
}

const endOfMonthIn = (months: number) => {
  const { year, month } = parseIsoDate(todayIso());
  const target = addMonths(year, month, months);
  return monthBounds(formatYearMonth(target.year, target.month)).to;
};

/** Dia guardado na coluna Day: dia da semana (0-6) no semanal, dia do mês nos demais. */
function dayOf(frequency: string, startDate: string): number {
  if (frequency !== RecurrenceFrequency.WEEKLY) return parseIsoDate(startDate).day;
  const { year, month, day } = parseIsoDate(startDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

@Injectable()
export class RecurrencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: EntryRules,
  ) {}

  async list(userId: string): Promise<RecurrenceDto[]> {
    const rows = await this.prisma.recurrence.findMany({
      where: { userId },
      select: RECURRENCE_SELECT,
    });
    return rows
      .map((row) => this.toDto(row))
      .sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          (a.nextDate ?? '9999').localeCompare(b.nextDate ?? '9999'),
      );
  }

  async get(userId: string, id: string): Promise<RecurrenceDto> {
    return this.toDto(await this.findOwned(userId, id));
  }

  async create(userId: string, input: RecurrenceInputParsed): Promise<RecurrenceDto> {
    await this.validate(userId, input);
    const created = await this.prisma.recurrence.create({
      data: { userId, ...this.toData(input), generatedUntil: null },
      select: { id: true },
    });
    await this.generate(userId, created.id, endOfMonthIn(HORIZON_MONTHS));
    return this.get(userId, created.id);
  }

  /**
   * Alterar a recorrência vale daqui para frente: as ocorrências previstas a partir
   * de hoje que não foram editadas à mão são refeitas com os novos dados.
   * O que já aconteceu (ou foi editado individualmente) fica como está.
   */
  async update(userId: string, id: string, input: RecurrenceInputParsed): Promise<RecurrenceDto> {
    const current = await this.findOwned(userId, id);
    await this.validate(userId, input, current);
    const yesterday = addDays(todayIso(), -1);

    await this.prisma.$transaction(async (tx) => {
      await this.deletePlanned(tx, userId, id, { from: todayIso() });
      const generated = current.generatedUntil ? fromDbDate(current.generatedUntil) : null;
      await tx.recurrence.update({
        where: { id },
        data: {
          ...this.toData(input),
          generatedUntil:
            generated && generated < yesterday ? toDbDate(generated) : toDbDate(yesterday),
        },
      });
    });
    await this.generate(userId, id, endOfMonthIn(HORIZON_MONTHS));
    return this.get(userId, id);
  }

  /** Encerra a recorrência: some o que estava previsto daqui para frente; o histórico fica. */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await this.deletePlanned(tx, userId, id, { from: todayIso(), includeEdited: true });
      await this.detachAndDelete(tx, userId, id);
    });
  }

  /** Gera o que faltar até `until` em todas as recorrências do usuário (chamado ao listar). */
  async ensureGenerated(userId: string, until: string): Promise<void> {
    const cap = endOfMonthIn(MAX_HORIZON_MONTHS);
    const target = until < cap ? until : cap;
    const pending = await this.prisma.recurrence.findMany({
      where: {
        userId,
        OR: [{ generatedUntil: null }, { generatedUntil: { lt: toDbDate(target) } }],
      },
      select: { id: true },
    });
    for (const { id } of pending) await this.generate(userId, id, target);
  }

  /**
   * "Desta em diante" numa ocorrência: a recorrência antiga termina na véspera e uma
   * nova começa com os novos dados. A própria ocorrência é atualizada e passa para a nova.
   */
  async splitFrom(userId: string, occurrence: OccurrenceRef, values: OccurrenceValues) {
    const current = await this.findOwned(userId, occurrence.recurrenceId);
    const isFirst = occurrence.originalDate <= fromDbDate(current.startDate);

    const targetId = await this.prisma.$transaction(async (tx) => {
      await this.deletePlanned(tx, userId, current.id, {
        after: occurrence.originalDate,
        exceptId: occurrence.id,
      });
      const fields = {
        ...this.toData({
          type: values.type,
          accountId: values.accountId,
          categoryId: values.categoryId,
          amountCents: values.amountCents,
          description: values.description,
          frequency: current.frequency as RecurrenceFrequency,
          startDate: values.date,
          endDate: current.endDate ? fromDbDate(current.endDate) : null,
        }),
        // A ocorrência editada já existe: a geração continua a partir dela
        generatedUntil: toDbDate(values.date),
      };

      let recurrenceId = current.id;
      if (isFirst) {
        await tx.recurrence.update({ where: { id: current.id }, data: fields });
      } else {
        await tx.recurrence.update({
          where: { id: current.id },
          data: { endDate: toDbDate(addDays(occurrence.originalDate, -1)) },
        });
        const created = await tx.recurrence.create({
          data: { userId, ...fields },
          select: { id: true },
        });
        recurrenceId = created.id;
      }

      const account = await tx.account.findFirstOrThrow({
        where: { id: values.accountId, userId },
        select: ACCOUNT_RULES,
      });
      const previous = await tx.transaction.findUniqueOrThrow({
        where: { id: occurrence.id },
        select: { invoiceId: true },
      });
      await tx.transaction.update({
        where: { id: occurrence.id },
        data: {
          ...(await entryData(tx, userId, account, values)),
          recurrenceId,
          originalDate: toDbDate(values.date),
          detached: false,
        },
      });
      await removeEmptyInvoices(tx, [previous.invoiceId]);
      return recurrenceId;
    });

    await this.generate(userId, targetId, endOfMonthIn(HORIZON_MONTHS));
  }

  /** Exclui a ocorrência e as próximas previstas; a recorrência termina na véspera. */
  async endFrom(userId: string, occurrence: OccurrenceRef): Promise<void> {
    const current = await this.findOwned(userId, occurrence.recurrenceId);
    await this.prisma.$transaction(async (tx) => {
      const target = await tx.transaction.findUniqueOrThrow({
        where: { id: occurrence.id },
        select: { invoiceId: true },
      });
      await tx.transaction.delete({ where: { id: occurrence.id } });
      await removeEmptyInvoices(tx, [target.invoiceId]);
      await this.deletePlanned(tx, userId, current.id, {
        after: occurrence.originalDate,
        includeEdited: true,
      });

      if (occurrence.originalDate <= fromDbDate(current.startDate)) {
        await this.detachAndDelete(tx, userId, current.id);
      } else {
        await tx.recurrence.update({
          where: { id: current.id },
          data: { endDate: toDbDate(addDays(occurrence.originalDate, -1)) },
        });
      }
    });
  }

  private async validate(
    userId: string,
    input: RecurrenceInputParsed,
    current?: { accountId: string; categoryId: string | null },
  ): Promise<void> {
    const account = await this.rules.findAccount(
      userId,
      input.accountId,
      'accountId',
      current?.accountId,
    );
    await this.rules.assertCategory(userId, input.categoryId, input.type, current?.categoryId);
    this.rules.assertAfterInitialBalance(account, input.startDate, 'startDate');
  }

  /**
   * Gera as ocorrências que faltam até `until`. A troca de `generatedUntil` é
   * condicional ao valor lido: se duas requisições chegarem juntas, só uma gera.
   */
  private async generate(userId: string, id: string, until: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const recurrence = await tx.recurrence.findFirst({
        where: { id, userId },
        select: {
          type: true,
          amount: true,
          description: true,
          frequency: true,
          startDate: true,
          endDate: true,
          generatedUntil: true,
          categoryId: true,
          account: { select: ACCOUNT_RULES },
        },
      });
      if (!recurrence) return;
      const after = recurrence.generatedUntil ? fromDbDate(recurrence.generatedUntil) : null;
      if (after && after >= until) return;

      const claimed = await tx.recurrence.updateMany({
        where: { id, generatedUntil: recurrence.generatedUntil },
        data: { generatedUntil: toDbDate(until) },
      });
      if (claimed.count === 0 || recurrence.account.archived || !recurrence.categoryId) return;

      const dates = recurrenceDates(
        {
          frequency: recurrence.frequency as RecurrenceFrequency,
          startDate: fromDbDate(recurrence.startDate),
          endDate: recurrence.endDate ? fromDbDate(recurrence.endDate) : null,
        },
        after,
        until,
      );
      if (dates.length === 0) return;

      // Datas que já têm ocorrência (por exemplo, a que foi editada "desta em diante")
      const existing = await tx.transaction.findMany({
        where: { recurrenceId: id, originalDate: { in: dates.map(toDbDate) } },
        select: { originalDate: true },
      });
      const taken = new Set(
        existing.map((row) => row.originalDate && fromDbDate(row.originalDate)),
      );

      const rows: Prisma.TransactionCreateManyInput[] = [];
      for (const date of dates) {
        if (taken.has(date)) continue;
        // Em conta corrente não há consulta aqui; no cartão, garante a fatura de cada data
        const data = await entryData(tx, userId, recurrence.account, {
          type: recurrence.type as 'INCOME' | 'EXPENSE',
          categoryId: recurrence.categoryId,
          amountCents: toCents(recurrence.amount.toString()),
          description: recurrence.description,
          date,
          status: TransactionStatus.PLANNED,
        });
        rows.push({ userId, ...data, recurrenceId: id, originalDate: toDbDate(date) });
      }
      // Em lotes: o SQL Server aceita até 2.100 parâmetros por comando
      for (let start = 0; start < rows.length; start += 100) {
        await tx.transaction.createMany({ data: rows.slice(start, start + 100) });
      }
    });
  }

  /**
   * Apaga ocorrências previstas a partir de uma data. Ao refazer a regra, as editadas
   * à mão ficam (`includeEdited: false`); ao encerrar, vão junto: não vão mais acontecer.
   */
  private async deletePlanned(
    tx: Tx,
    userId: string,
    recurrenceId: string,
    range: { from?: string; after?: string; exceptId?: string; includeEdited?: boolean },
  ): Promise<void> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      recurrenceId,
      status: TransactionStatus.PLANNED,
      ...(range.includeEdited ? {} : { detached: false }),
      originalDate: range.after ? { gt: toDbDate(range.after) } : { gte: toDbDate(range.from!) },
      ...(range.exceptId ? { NOT: { id: range.exceptId } } : {}),
    };
    // Compras no cartão ficam como realizadas; as futuras também saem
    const cardWhere: Prisma.TransactionWhereInput = {
      ...where,
      status: TransactionStatus.PAID,
      invoiceId: { not: null },
    };
    const rows = await tx.transaction.findMany({
      where: { OR: [where, cardWhere] },
      select: { id: true, invoiceId: true },
    });
    if (rows.length === 0) return;
    await tx.transaction.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    await removeEmptyInvoices(
      tx,
      rows.map((row) => row.invoiceId),
    );
  }

  /** O histórico continua, só deixa de apontar para a recorrência. */
  private async detachAndDelete(tx: Tx, userId: string, id: string): Promise<void> {
    await tx.transaction.updateMany({
      where: { userId, recurrenceId: id },
      data: { recurrenceId: null, originalDate: null },
    });
    await tx.recurrence.delete({ where: { id } });
  }

  private async findOwned(userId: string, id: string): Promise<RecurrenceRow> {
    const row = await this.prisma.recurrence.findFirst({
      where: { id, userId },
      select: RECURRENCE_SELECT,
    });
    if (!row) throw new NotFoundException('Recorrência não encontrada');
    return row;
  }

  private toData(input: RecurrenceInputParsed) {
    return {
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      amount: fromCents(input.amountCents),
      description: input.description,
      frequency: input.frequency,
      day: dayOf(input.frequency, input.startDate),
      startDate: toDbDate(input.startDate),
      endDate: input.endDate ? toDbDate(input.endDate) : null,
    };
  }

  private toDto(row: RecurrenceRow): RecurrenceDto {
    const amountCents = toCents(row.amount.toString());
    const frequency = row.frequency as RecurrenceFrequency;
    const endDate = row.endDate ? fromDbDate(row.endDate) : null;
    const rule = { frequency, startDate: fromDbDate(row.startDate), endDate };
    const nextDate = nextOccurrence(rule, todayIso());
    return {
      id: row.id,
      type: row.type as RecurrenceDto['type'],
      account: { ...row.account, type: row.account.type as RecurrenceDto['account']['type'] },
      category: row.category
        ? {
            id: row.category.id,
            name: row.category.name,
            color: row.category.color,
            icon: row.category.icon ?? row.category.parent?.icon ?? null,
            parentId: row.category.parentId,
          }
        : null,
      amountCents,
      description: row.description,
      frequency,
      startDate: rule.startDate,
      endDate,
      nextDate,
      monthlyCents: monthlyEquivalent(amountCents, frequency),
      active: nextDate !== null,
    };
  }
}
