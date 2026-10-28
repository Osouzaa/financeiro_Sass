import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AccountType,
  TransactionStatus,
  TransactionType,
  todayIso,
  type TransactionStatus as Status,
} from '@financeiro/shared';
import { fromDbDate } from '../common/db-date';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const ACCOUNT_RULES = {
  id: true,
  name: true,
  type: true,
  archived: true,
  closingDay: true,
  dueDay: true,
  initialBalanceDate: true,
} as const;

export type RulesAccount = Prisma.AccountGetPayload<{ select: typeof ACCOUNT_RULES }>;

const brDate = (iso: string) => iso.split('-').reverse().join('/');

/** Erro de validação preso a um campo do formulário. */
export const fieldError = (field: string, message: string) =>
  new BadRequestException({ message, fields: { [field]: [message] } });

/**
 * Regras de conta, categoria e data que valem para lançamentos e recorrências.
 * Tudo é buscado pelo usuário do token: o que é de outra pessoa responde
 * "não encontrado", sem revelar que existe.
 */
@Injectable()
export class EntryRules {
  constructor(private readonly prisma: PrismaService) {}

  /** Conta apta a receber lançamentos. `keepId` aceita a conta atual mesmo se arquivada. */
  async findAccount(
    userId: string,
    id: string,
    field: string,
    keepId?: string | null,
  ): Promise<RulesAccount> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
      select: ACCOUNT_RULES,
    });
    if (!account) throw fieldError(field, 'Conta não encontrada');
    if (account.archived && account.id !== keepId) {
      throw fieldError(field, `A conta ${account.name} está arquivada`);
    }
    return account;
  }

  async assertCategory(
    userId: string,
    id: string,
    type: string,
    keepId?: string | null,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
      select: { type: true, archived: true },
    });
    if (!category) throw fieldError('categoryId', 'Categoria não encontrada');
    if (category.type !== type) {
      throw fieldError(
        'categoryId',
        type === TransactionType.INCOME
          ? 'Escolha uma categoria de receita'
          : 'Escolha uma categoria de despesa',
      );
    }
    if (category.archived && id !== keepId) {
      throw fieldError('categoryId', 'Esta categoria está arquivada');
    }
  }

  assertDates(account: RulesAccount, date: string, status: Status, field = 'date'): void {
    if (account.type === AccountType.CREDIT_CARD) return;
    this.assertAfterInitialBalance(account, date, field);
    this.assertStatus(date, status);
  }

  /** O saldo parte do saldo inicial; lançamentos anteriores a ele bagunçariam a conta. */
  assertAfterInitialBalance(account: RulesAccount, date: string, field = 'date'): void {
    if (account.type === AccountType.CREDIT_CARD) return;
    const start = fromDbDate(account.initialBalanceDate);
    if (date < start) {
      throw fieldError(
        field,
        `A conta ${account.name} começa em ${brDate(start)}, data do saldo inicial`,
      );
    }
  }

  /** Lançamento futuro não pode estar realizado: o saldo atual ficaria errado. */
  assertStatus(date: string, status: Status): void {
    if (status === TransactionStatus.PAID && date > todayIso()) {
      throw fieldError('status', 'Lançamentos com data futura ficam como previstos');
    }
  }
}
