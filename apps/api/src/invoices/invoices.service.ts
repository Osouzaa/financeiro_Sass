import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  todayIso,
  type InvoiceDetailDto,
  type InvoiceDto,
  type InvoiceFilterParsed,
  type InvoicePaymentInputParsed,
  type TransactionDto,
} from '@financeiro/shared';
import { fromDbDate } from '../common/db-date';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { invoiceStatus, invoiceTotals, type InvoiceGroup } from './invoice-math';

/** Histórico exibido por cartão: dois anos de faturas é mais do que suficiente na tela. */
const LIST_LIMIT = 36;

const INVOICE_SELECT = {
  id: true,
  referenceMonth: true,
  closingDate: true,
  dueDate: true,
  account: {
    select: { id: true, name: true, type: true, color: true, paymentAccountId: true },
  },
} as const satisfies Prisma.InvoiceSelect;

type InvoiceRow = Prisma.InvoiceGetPayload<{ select: typeof INVOICE_SELECT }>;

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  async list(userId: string, filter: InvoiceFilterParsed): Promise<InvoiceDto[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        userId,
        ...(filter.accountId ? { accountId: filter.accountId } : { account: { archived: false } }),
      },
      select: INVOICE_SELECT,
      orderBy: { dueDate: 'desc' },
      take: filter.accountId ? LIST_LIMIT : LIST_LIMIT * 4,
    });
    const invoices = await this.toDtos(userId, rows);
    return filter.unpaid ? invoices.filter((invoice) => invoice.remainingCents > 0) : invoices;
  }

  async get(userId: string, id: string): Promise<InvoiceDetailDto> {
    const row = await this.findOwned(userId, id);
    const [[invoice], items] = await Promise.all([
      this.toDtos(userId, [row]),
      this.transactions.listByInvoice(userId, id),
    ]);
    return { ...invoice!, items };
  }

  /** Pagar é transferir da conta escolhida para o cartão, ligando o pagamento a esta fatura. */
  async pay(userId: string, id: string, input: InvoicePaymentInputParsed): Promise<TransactionDto> {
    const invoice = await this.findOwned(userId, id);
    if (input.fromAccountId === invoice.account.id) {
      throw new BadRequestException({
        message: 'Escolha a conta de onde sai o pagamento',
        fields: { fromAccountId: ['O cartão não paga a própria fatura'] },
      });
    }
    const month = MONTHS[Number(invoice.referenceMonth.slice(5, 7)) - 1];
    return this.transactions.createTransfer(
      userId,
      {
        fromAccountId: input.fromAccountId,
        toAccountId: invoice.account.id,
        amountCents: input.amountCents,
        description: `Pagamento da fatura ${invoice.account.name} (${month})`,
        notes: null,
        date: input.date,
        status: input.status,
      },
      invoice.id,
    );
  }

  private async findOwned(userId: string, id: string): Promise<InvoiceRow> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, userId },
      select: INVOICE_SELECT,
    });
    if (!row) throw new NotFoundException('Fatura não encontrada');
    return row;
  }

  private async toDtos(userId: string, rows: InvoiceRow[]): Promise<InvoiceDto[]> {
    if (rows.length === 0) return [];
    const groups = await this.prisma.transaction.groupBy({
      by: ['invoiceId', 'type', 'status', 'transferDirection'],
      where: { userId, invoiceId: { in: rows.map((row) => row.id) } },
      _sum: { amount: true },
    });
    const byInvoice = new Map<string, InvoiceGroup[]>();
    for (const group of groups) {
      if (!group.invoiceId) continue;
      const list = byInvoice.get(group.invoiceId) ?? [];
      list.push({
        type: group.type,
        status: group.status,
        transferDirection: group.transferDirection,
        amount: group._sum.amount?.toString() ?? '0',
      });
      byInvoice.set(group.invoiceId, list);
    }

    const today = todayIso();
    return rows.map((row) => {
      const totals = invoiceTotals(byInvoice.get(row.id) ?? []);
      const dates = { closingDate: fromDbDate(row.closingDate), dueDate: fromDbDate(row.dueDate) };
      const { paymentAccountId, ...account } = row.account;
      return {
        id: row.id,
        account: { ...account, type: account.type as InvoiceDto['account']['type'] },
        paymentAccountId,
        referenceMonth: row.referenceMonth,
        ...dates,
        ...invoiceStatus(totals, dates, today),
        ...totals,
      };
    });
  }
}
