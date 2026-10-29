import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  AccountType,
  FREE_PLAN_CODE,
  PlanInterval,
  SubscriptionStatus,
  UserRole,
  UserStatus,
  fromCents,
  maskCpf,
  normalizeCpf,
  todayIso,
  toCents,
  type AdminMetricsDto,
  type AdminSubscriptionInputParsed,
  type AdminUserDto,
  type AdminUsersQuery,
  type AuditEntryDto,
  type PageDto,
  type PlanDto,
  type PlanInputParsed,
} from '@financeiro/shared';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { BillingService } from '../billing/billing.service';
import { toDbDate } from '../common/db-date';
import { AppConfig } from '../config/app-config';
import type { Prisma } from '../generated/prisma/client';
import { PLAN_SELECT, PlansService, toPlanDto } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 20;

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly plans: PlansService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly billing: BillingService,
  ) {}

  /** Promove os e-mails de SUPER_ADMIN_EMAILS. Só promove: tirar alguém é decisão manual. */
  async onApplicationBootstrap(): Promise<void> {
    const emails = this.config.superAdminEmails;
    if (emails.length === 0) return;
    const promoted = await this.prisma.user.updateMany({
      where: { email: { in: emails }, NOT: { role: UserRole.SUPER_ADMIN } },
      data: { role: UserRole.SUPER_ADMIN },
    });
    if (promoted.count > 0)
      this.logger.log(`${promoted.count} conta(s) promovida(s) a super admin`);
  }

  async listUsers(query: AdminUsersQuery): Promise<PageDto<AdminUserDto>> {
    const digits = query.q ? normalizeCpf(query.q) : '';
    const where: Prisma.UserWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { email: { contains: query.q } },
            ...(digits.length >= 3 ? [{ cpf: { cpf: { contains: digits } } }] : []),
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          role: true,
          status: true,
          createdAt: true,
          cpf: { select: { cpf: true } },
          subscription: {
            select: {
              status: true,
              currentPeriodEnd: true,
              provider: true,
              plan: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
    ]);

    const free = await this.plans.freePlan();
    const usage = await this.usageFor(rows.map((row) => row.id));
    return {
      page: query.page,
      pageSize: PAGE_SIZE,
      total,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: Boolean(row.emailVerifiedAt),
        cpfMasked: row.cpf ? maskCpf(row.cpf.cpf) : null,
        role: row.role as AdminUserDto['role'],
        status: row.status as AdminUserDto['status'],
        plan: row.subscription?.plan ?? { id: free.id, code: free.code, name: free.name },
        subscriptionStatus:
          (row.subscription?.status as AdminUserDto['subscriptionStatus']) ?? null,
        subscriptionProvider: row.subscription?.provider ?? null,
        currentPeriodEnd: row.subscription?.currentPeriodEnd
          ? row.subscription.currentPeriodEnd.toISOString().slice(0, 10)
          : null,
        createdAt: row.createdAt.toISOString(),
        usage: usage.get(row.id) ?? { accounts: 0, cards: 0, recurrences: 0, budgets: 0 },
      })),
    };
  }

  /** Define o plano de qualquer conta, inclusive a do próprio super admin. */
  async setSubscription(
    actorId: string,
    userId: string,
    input: AdminSubscriptionInputParsed,
  ): Promise<void> {
    const [user, plan, previous] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      this.prisma.plan.findUnique({
        where: { id: input.planId },
        select: { id: true, name: true, isActive: true },
      }),
      this.prisma.subscription.findUnique({
        where: { userId },
        select: { status: true, plan: { select: { name: true } } },
      }),
    ]);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (!plan)
      throw new BadRequestException({
        message: 'Plano não encontrado',
        fields: { planId: ['Plano não encontrado'] },
      });
    if (!plan.isActive) {
      throw new BadRequestException({
        message: 'Este plano está desativado',
        fields: { planId: ['Plano desativado'] },
      });
    }

    const data = {
      planId: plan.id,
      status: input.status,
      currentPeriodEnd: input.currentPeriodEnd ? toDbDate(input.currentPeriodEnd) : null,
      provider: 'MANUAL',
    };
    await this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    await this.audit(actorId, 'SUBSCRIPTION_CHANGED', 'USER', userId, {
      email: user.email,
      from: previous ? `${previous.plan.name} (${previous.status})` : 'Grátis (sem assinatura)',
      to: `${plan.name} (${input.status})`,
      until: input.currentPeriodEnd,
    });
  }

  /** Suspende ou reativa. Suspender derruba todas as sessões da pessoa na hora. */
  async setStatus(actorId: string, userId: string, status: UserStatus): Promise<void> {
    if (actorId === userId) {
      throw new BadRequestException('Você não pode suspender a própria conta');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    if (status === UserStatus.SUSPENDED) await this.refreshTokens.revokeAll(userId);
    await this.audit(
      actorId,
      status === UserStatus.SUSPENDED ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      'USER',
      userId,
      { email: user.email },
    );
  }

  /** Cancela a cobrança recorrente de uma conta no Mercado Pago (o plano vale até o fim do período). */
  async cancelBilling(actorId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.billing.cancel(userId);
    await this.audit(actorId, 'BILLING_CANCELED', 'USER', userId, { email: user.email });
  }

  async listPlans(): Promise<PlanDto[]> {
    const rows = await this.prisma.plan.findMany({
      select: PLAN_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toPlanDto);
  }

  async createPlan(actorId: string, input: PlanInputParsed): Promise<PlanDto> {
    await this.assertCodeFree(input.code);
    const created = await this.prisma.plan.create({
      data: this.planData(input),
      select: PLAN_SELECT,
    });
    await this.audit(actorId, 'PLAN_CREATED', 'PLAN', created.id, {
      code: input.code,
      name: input.name,
    });
    return toPlanDto(created);
  }

  async updatePlan(actorId: string, id: string, input: PlanInputParsed): Promise<PlanDto> {
    const current = await this.prisma.plan.findUnique({ where: { id }, select: { code: true } });
    if (!current) throw new NotFoundException('Plano não encontrado');
    // O grátis é o plano de quem não tem assinatura: precisa existir e continuar ativo
    if (current.code === FREE_PLAN_CODE) {
      if (input.code !== FREE_PLAN_CODE) {
        throw new BadRequestException({
          message: 'O código do plano grátis não muda',
          fields: { code: ['Mantenha "free"'] },
        });
      }
      if (!input.isActive) {
        throw new BadRequestException({
          message: 'O plano grátis não pode ser desativado',
          fields: { isActive: ['Sempre ativo'] },
        });
      }
    }
    if (input.code !== current.code) await this.assertCodeFree(input.code);
    const updated = await this.prisma.plan.update({
      where: { id },
      data: this.planData(input),
      select: PLAN_SELECT,
    });
    await this.audit(actorId, 'PLAN_UPDATED', 'PLAN', id, {
      code: input.code,
      price: input.priceCents,
      isPublic: input.isPublic,
      isActive: input.isActive,
    });
    return toPlanDto(updated);
  }

  async metrics(): Promise<AdminMetricsDto> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [users, newUsers, suspended, plans, subscriptions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.plan.findMany({ select: { id: true, code: true, name: true, sortOrder: true } }),
      this.prisma.subscription.findMany({
        select: {
          status: true,
          currentPeriodEnd: true,
          planId: true,
          plan: { select: { priceAmount: true, interval: true } },
        },
      }),
    ]);

    const today = toDbDate(todayIso());
    const counting = subscriptions.filter(
      (subscription) =>
        subscription.status !== SubscriptionStatus.CANCELED &&
        (!subscription.currentPeriodEnd || subscription.currentPeriodEnd >= today),
    );
    const byPlan = new Map<string, number>();
    for (const subscription of counting) {
      byPlan.set(subscription.planId, (byPlan.get(subscription.planId) ?? 0) + 1);
    }
    // Quem não tem assinatura valendo está no grátis
    const free = plans.find((plan) => plan.code === FREE_PLAN_CODE);
    const paying = [...byPlan.entries()]
      .filter(([planId]) => planId !== free?.id)
      .reduce((sum, [, count]) => sum + count, 0);
    if (free) byPlan.set(free.id, users - paying);

    const mrrCents = counting
      .filter((subscription) => subscription.status === SubscriptionStatus.ACTIVE)
      .reduce((sum, subscription) => {
        const price = toCents(subscription.plan.priceAmount.toString());
        return (
          sum + (subscription.plan.interval === PlanInterval.YEAR ? Math.round(price / 12) : price)
        );
      }, 0);

    return {
      users,
      newUsersLast30Days: newUsers,
      suspended,
      byPlan: plans
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((plan) => ({ planId: plan.id, name: plan.name, users: byPlan.get(plan.id) ?? 0 })),
      mrrCents,
    };
  }

  async auditLog(page: number): Promise<PageDto<AuditEntryDto>> {
    const [total, rows] = await Promise.all([
      this.prisma.adminAuditLog.count(),
      this.prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          details: true,
          createdAt: true,
          actor: { select: { id: true, name: true } },
        },
      }),
    ]);
    return {
      page,
      pageSize: PAGE_SIZE,
      total,
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    };
  }

  private async assertCodeFree(code: string): Promise<void> {
    const taken = await this.prisma.plan.findUnique({ where: { code }, select: { id: true } });
    if (taken) {
      throw new ConflictException({
        message: 'Já existe um plano com este código',
        fields: { code: ['Código em uso'] },
      });
    }
  }

  private planData(input: PlanInputParsed) {
    return {
      code: input.code,
      name: input.name,
      description: input.description,
      priceAmount: fromCents(input.priceCents),
      interval: input.interval,
      isPublic: input.isPublic,
      isActive: input.isActive,
      highlighted: input.highlighted,
      sortOrder: input.sortOrder,
      trialDays: input.trialDays,
      features: JSON.stringify(input.features),
      maxAccounts: input.limits.maxAccounts,
      maxCards: input.limits.maxCards,
      maxRecurrences: input.limits.maxRecurrences,
      maxBudgets: input.limits.maxBudgets,
      projectionDays: input.limits.projectionDays,
      whatsapp: input.limits.whatsapp,
    };
  }

  /** Uso de cada conta da página, em poucas consultas agrupadas. */
  private async usageFor(userIds: string[]) {
    const map = new Map<string, AdminUserDto['usage']>();
    if (userIds.length === 0) return map;
    const today = toDbDate(todayIso());
    const [accounts, recurrences, budgets] = await Promise.all([
      this.prisma.account.groupBy({
        by: ['userId', 'type'],
        where: { userId: { in: userIds }, archived: false },
        _count: { _all: true },
      }),
      this.prisma.recurrence.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, OR: [{ endDate: null }, { endDate: { gte: today } }] },
        _count: { _all: true },
      }),
      this.prisma.budget.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, month: todayIso().slice(0, 7) },
        _count: { _all: true },
      }),
    ]);
    const entry = (id: string) => {
      const current = map.get(id) ?? { accounts: 0, cards: 0, recurrences: 0, budgets: 0 };
      map.set(id, current);
      return current;
    };
    for (const row of accounts) {
      if (row.type === AccountType.CREDIT_CARD) entry(row.userId).cards += row._count._all;
      else entry(row.userId).accounts += row._count._all;
    }
    for (const row of recurrences) entry(row.userId).recurrences = row._count._all;
    for (const row of budgets) entry(row.userId).budgets = row._count._all;
    return map;
  }

  private async audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        details: JSON.stringify(details).slice(0, 2000),
      },
    });
  }
}
