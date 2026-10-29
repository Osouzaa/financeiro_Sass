import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountType,
  FREE_PLAN_CODE,
  SubscriptionStatus,
  toCents,
  todayIso,
  type MyPlanDto,
  type PlanDto,
  type PlanLimits,
  type PlanUsageDto,
} from '@financeiro/shared';
import { toDbDate } from '../common/db-date';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const PLAN_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  priceAmount: true,
  interval: true,
  isPublic: true,
  isActive: true,
  highlighted: true,
  sortOrder: true,
  features: true,
  maxAccounts: true,
  maxCards: true,
  maxRecurrences: true,
  maxBudgets: true,
  projectionDays: true,
  whatsapp: true,
} as const satisfies Prisma.PlanSelect;

export type PlanRow = Prisma.PlanGetPayload<{ select: typeof PLAN_SELECT }>;

/** Limite que tem contagem (os demais são liga/desliga ou período). */
type CountedLimit = 'maxAccounts' | 'maxCards' | 'maxRecurrences' | 'maxBudgets';

const LIMIT_TEXT: Record<CountedLimit, (max: number) => string> = {
  maxAccounts: (max) => `até ${max} ${max === 1 ? 'conta' : 'contas'}`,
  maxCards: (max) => `até ${max} ${max === 1 ? 'cartão' : 'cartões'}`,
  maxRecurrences: (max) => `até ${max} ${max === 1 ? 'recorrência ativa' : 'recorrências ativas'}`,
  maxBudgets: (max) => `limite em até ${max} ${max === 1 ? 'categoria' : 'categorias'} por mês`,
};

export function toPlanDto(row: PlanRow): PlanDto {
  let features: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.features);
    if (Array.isArray(parsed)) features = parsed.filter((item) => typeof item === 'string');
  } catch {
    // Texto inválido no banco não derruba a vitrine
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    priceCents: toCents(row.priceAmount.toString()),
    interval: row.interval as PlanDto['interval'],
    isPublic: row.isPublic,
    isActive: row.isActive,
    highlighted: row.highlighted,
    sortOrder: row.sortOrder,
    features,
    limits: {
      maxAccounts: row.maxAccounts,
      maxCards: row.maxCards,
      maxRecurrences: row.maxRecurrences,
      maxBudgets: row.maxBudgets,
      projectionDays: row.projectionDays,
      whatsapp: row.whatsapp,
    },
  };
}

/** Assinatura que ainda dá direito ao plano (cancelada ou vencida volta para o grátis). */
function grantsPlan(subscription: { status: string; currentPeriodEnd: Date | null }): boolean {
  if (subscription.status === SubscriptionStatus.CANCELED) {
    // Cancelada vale até o fim do período já pago
    return Boolean(
      subscription.currentPeriodEnd && toDbDate(todayIso()) <= subscription.currentPeriodEnd,
    );
  }
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < toDbDate(todayIso())) {
    return false;
  }
  return true;
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vitrine: planos públicos e ativos, na ordem definida pelo super admin. */
  async listPublic(): Promise<PlanDto[]> {
    const rows = await this.prisma.plan.findMany({
      where: { isPublic: true, isActive: true },
      select: PLAN_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toPlanDto);
  }

  async freePlan(): Promise<PlanRow> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: FREE_PLAN_CODE },
      select: PLAN_SELECT,
    });
    if (!plan) throw new NotFoundException('Plano grátis não configurado');
    return plan;
  }

  /** Plano que vale hoje para o usuário. */
  async effectivePlan(userId: string): Promise<PlanRow> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true, plan: { select: PLAN_SELECT } },
    });
    return subscription && grantsPlan(subscription) ? subscription.plan : this.freePlan();
  }

  async limits(userId: string): Promise<{ planName: string; limits: PlanLimits }> {
    const plan = toPlanDto(await this.effectivePlan(userId));
    return { planName: plan.name, limits: plan.limits };
  }

  async myPlan(userId: string): Promise<MyPlanDto> {
    const [plan, subscription, usage] = await Promise.all([
      this.effectivePlan(userId),
      this.prisma.subscription.findUnique({
        where: { userId },
        select: { status: true, currentPeriodEnd: true, provider: true },
      }),
      this.usage(userId),
    ]);
    return {
      plan: toPlanDto(plan),
      subscription: subscription
        ? {
            status: subscription.status as SubscriptionStatus,
            currentPeriodEnd: subscription.currentPeriodEnd
              ? subscription.currentPeriodEnd.toISOString().slice(0, 10)
              : null,
            provider: subscription.provider,
          }
        : null,
      usage,
    };
  }

  async usage(userId: string): Promise<PlanUsageDto> {
    const today = toDbDate(todayIso());
    const [accounts, cards, recurrences, budgets] = await Promise.all([
      this.prisma.account.count({
        where: { userId, archived: false, NOT: { type: AccountType.CREDIT_CARD } },
      }),
      this.prisma.account.count({
        where: { userId, archived: false, type: AccountType.CREDIT_CARD },
      }),
      this.prisma.recurrence.count({
        where: { userId, OR: [{ endDate: null }, { endDate: { gte: today } }] },
      }),
      this.prisma.budget.count({ where: { userId, month: todayIso().slice(0, 7) } }),
    ]);
    return { accounts, cards, recurrences, budgets };
  }

  /**
   * Barra o que passaria do limite do plano. `adding` é quantos itens a operação
   * cria. O erro leva um código para o front mostrar o convite de troca de plano.
   */
  async assertWithin(
    userId: string,
    limit: CountedLimit,
    current: number,
    adding = 1,
  ): Promise<void> {
    const { planName, limits } = await this.limits(userId);
    const max = limits[limit];
    if (max === null || current + adding <= max) return;
    throw new ForbiddenException({
      message: `O plano ${planName} permite ${LIMIT_TEXT[limit](max)}. Troque de plano para liberar mais.`,
      code: 'PLAN_LIMIT',
      meta: { limit, planName },
    });
  }

  /** Projeção além do que o plano cobre. */
  async assertProjectionDays(userId: string, days: number): Promise<void> {
    const { planName, limits } = await this.limits(userId);
    if (days <= limits.projectionDays) return;
    throw new ForbiddenException({
      message: `O plano ${planName} projeta até ${limits.projectionDays} dias. Troque de plano para ver mais longe.`,
      code: 'PLAN_LIMIT',
      meta: { limit: 'projectionDays', planName },
    });
  }
}
