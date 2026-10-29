import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  PlanInterval,
  SubscriptionStatus,
  toCents,
  fromCents,
  type AdminBillingDto,
  type AdminPaymentDto,
  type AdminPaymentsQuery,
  type CheckoutDto,
  type PageDto,
  type PaymentDto,
} from '@financeiro/shared';
import { AppConfig } from '../config/app-config';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paymentStatusFrom, periodEndFrom, subscriptionStatusFrom } from './billing-mapping';
import { MercadoPagoClient, type MpPreapproval } from './mercadopago.client';
import { verifyMercadoPagoSignature } from './mp-signature';

export const PROVIDER = 'MERCADO_PAGO';
const PAGE_SIZE = 20;

/** Status que ainda dão direito ao plano pago (não deixam assinar de novo por cima). */
const LIVE_STATUSES: string[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];

export interface WebhookInput {
  headers: { signature?: string; requestId?: string };
  query: Record<string, unknown>;
  body: unknown;
}

const asString = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly mp: MercadoPagoClient,
  ) {}

  get enabled(): boolean {
    return this.mp.configured;
  }

  /**
   * Cria a assinatura no Mercado Pago e devolve a página onde a pessoa informa o
   * cartão. Com teste grátis, a primeira cobrança é agendada para depois do teste:
   * o teste só começa quando o cartão é autorizado, e vale uma vez por pessoa.
   */
  async checkout(userId: string, planId: string): Promise<CheckoutDto> {
    const [user, plan, current] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, trialUsedAt: true },
      }),
      this.prisma.plan.findUnique({
        where: { id: planId },
        select: {
          id: true,
          name: true,
          priceAmount: true,
          interval: true,
          isActive: true,
          trialDays: true,
        },
      }),
      this.prisma.subscription.findUnique({
        where: { userId },
        select: { provider: true, status: true, currentPeriodEnd: true },
      }),
    ]);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const priceCents = plan ? toCents(plan.priceAmount.toString()) : 0;
    if (!plan || !plan.isActive || priceCents <= 0) {
      throw new BadRequestException({
        message: 'Escolha um plano pago disponível',
        fields: { planId: ['Plano indisponível'] },
      });
    }
    if (current?.provider === PROVIDER && LIVE_STATUSES.includes(current.status)) {
      throw new ConflictException(
        'Você já tem uma assinatura ativa. Cancele-a antes de trocar de plano.',
      );
    }

    const trialDays = user.trialUsedAt ? 0 : plan.trialDays;
    const session = await this.prisma.checkoutSession.create({
      data: { userId, planId: plan.id, trialDays, amount: plan.priceAmount },
      select: { id: true },
    });

    const firstCharge = trialDays > 0 ? new Date(Date.now() + trialDays * 86_400_000) : null;
    const preapproval = await this.mp.createPreapproval(
      {
        reason: `Financeiro ${plan.name}`,
        external_reference: session.id,
        payer_email: this.config.mercadoPago.testPayerEmail ?? user.email,
        back_url: `${this.config.appUrl}/configuracoes/plano?assinatura=retorno`,
        status: 'pending',
        auto_recurring: {
          frequency: plan.interval === PlanInterval.YEAR ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: priceCents / 100,
          currency_id: 'BRL',
          ...(firstCharge ? { start_date: firstCharge.toISOString() } : {}),
        },
      },
      session.id,
    );
    if (!preapproval.init_point) {
      throw new BadRequestException(
        'O Mercado Pago não devolveu a página de pagamento. Tente de novo.',
      );
    }
    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: { providerRef: preapproval.id, initPoint: preapproval.init_point },
    });
    return { url: preapproval.init_point };
  }

  /**
   * Busca no Mercado Pago o status da última assinatura da pessoa. Usado na volta
   * do checkout: não depende do webhook ter chegado (em desenvolvimento ele não chega).
   */
  async sync(userId: string): Promise<void> {
    if (!this.enabled) return;
    const session = await this.prisma.checkoutSession.findFirst({
      where: { userId, providerRef: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { providerRef: true },
    });
    if (session?.providerRef) await this.syncPreapproval(session.providerRef);
  }

  /** Cancela a cobrança recorrente. O plano continua até o fim do período já pago. */
  async cancel(userId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { provider: true, providerRef: true, status: true },
    });
    if (!subscription || subscription.provider !== PROVIDER || !subscription.providerRef) {
      throw new BadRequestException('Não há assinatura do Mercado Pago para cancelar');
    }
    if (subscription.status === SubscriptionStatus.CANCELED) return;
    await this.mp.cancelPreapproval(subscription.providerRef);
    await this.prisma.subscription.update({
      where: { userId },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });
  }

  /** Para a exclusão de conta: cancela a cobrança sem travar a exclusão se o provedor falhar. */
  async cancelQuietly(userId: string): Promise<void> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        select: { provider: true, status: true },
      });
      if (
        subscription?.provider === PROVIDER &&
        subscription.status !== SubscriptionStatus.CANCELED
      ) {
        await this.cancel(userId);
      }
    } catch (error) {
      this.logger.error(`Não foi possível cancelar a assinatura de ${userId}: ${String(error)}`);
      throw new ConflictException(
        'Não conseguimos cancelar sua assinatura no Mercado Pago agora. Tente excluir a conta de novo em instantes.',
      );
    }
  }

  async myPayments(userId: string): Promise<PaymentDto[]> {
    const rows = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        status: true,
        description: true,
        paidAt: true,
        createdAt: true,
      },
    });
    return rows.map((row) => this.toPaymentDto(row));
  }

  /**
   * Webhook do Mercado Pago. A assinatura do aviso é conferida, e o conteúdo do
   * aviso nunca é usado como verdade: o recurso é buscado de novo na API do
   * Mercado Pago. Avisos já processados são ignorados (idempotência).
   */
  async handleWebhook(input: WebhookInput): Promise<'ok' | 'rejected'> {
    const body = (input.body ?? {}) as { type?: unknown; topic?: unknown; data?: { id?: unknown } };
    const type =
      asString(body.type) ??
      asString(input.query.type) ??
      asString(input.query.topic) ??
      'desconhecido';
    const dataId =
      asString(input.query['data.id']) ?? asString(body.data?.id) ?? asString(input.query.id);
    const requestId = input.headers.requestId?.slice(0, 100);

    const secret = this.config.mercadoPago.webhookSecret;
    if (secret) {
      const valid = verifyMercadoPagoSignature({
        secret,
        signatureHeader: input.headers.signature,
        requestId,
        dataId,
      });
      if (!valid) {
        await this.logEvent({
          requestId: null,
          type,
          resourceId: dataId,
          status: 'REJECTED',
          error: 'Assinatura inválida',
        });
        return 'rejected';
      }
    } else if (this.config.isProduction) {
      await this.logEvent({
        requestId: null,
        type,
        resourceId: dataId,
        status: 'REJECTED',
        error: 'MP_WEBHOOK_SECRET ausente',
      });
      return 'rejected';
    }

    if (requestId) {
      const seen = await this.prisma.webhookEvent.findUnique({
        where: { requestId },
        select: { status: true },
      });
      if (seen && seen.status !== 'FAILED') return 'ok';
    }

    const eventId = await this.logEvent({
      requestId: requestId ?? null,
      type,
      resourceId: dataId,
      status: 'RECEIVED',
    });
    try {
      let handled = false;
      if (dataId && ['subscription_preapproval', 'preapproval'].includes(type)) {
        handled = await this.syncPreapproval(dataId);
      } else if (
        dataId &&
        ['subscription_authorized_payment', 'authorized_payment'].includes(type)
      ) {
        handled = await this.recordAuthorizedPayment(dataId);
      }
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: handled ? 'PROCESSED' : 'IGNORED', processedAt: new Date(), error: null },
      });
      return 'ok';
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: 'FAILED', error: String(error).slice(0, 1000) },
      });
      // Falha transitória: o Mercado Pago tenta de novo
      throw error;
    }
  }

  /** Aplica o status atual da assinatura no Mercado Pago. false se não for nossa. */
  async syncPreapproval(preapprovalId: string): Promise<boolean> {
    const preapproval = await this.mp.getPreapproval(preapprovalId);
    const session = await this.findSession(preapproval);
    if (!session) {
      this.logger.warn(`Assinatura ${preapprovalId} sem sessão de checkout correspondente`);
      return false;
    }

    const firstChargeAt = preapproval.auto_recurring?.start_date
      ? new Date(preapproval.auto_recurring.start_date)
      : null;
    const hasApprovedPayment =
      (await this.prisma.payment.count({
        where: { providerRef: preapproval.id, status: PaymentStatus.APPROVED },
      })) > 0;
    const status = subscriptionStatusFrom(preapproval.status, {
      firstChargeAt,
      hasApprovedPayment,
    });
    if (!status) return true;

    const current = await this.prisma.subscription.findUnique({
      where: { userId: session.userId },
      select: { providerRef: true, currentPeriodEnd: true },
    });

    if (status === SubscriptionStatus.CANCELED) {
      await this.prisma.checkoutSession.update({
        where: { id: session.id },
        data: { status: 'CANCELED' },
      });
      // Só mexe na assinatura se ela ainda for esta
      if (current?.providerRef === preapproval.id) {
        await this.prisma.subscription.update({
          where: { userId: session.userId },
          data: {
            status,
            canceledAt: new Date(),
            currentPeriodEnd: current.currentPeriodEnd ?? new Date(),
          },
        });
      }
      return true;
    }

    const trial = status === SubscriptionStatus.TRIALING && firstChargeAt;
    const periodEnd =
      periodEndFrom(preapproval.next_payment_date ?? preapproval.auto_recurring?.start_date) ??
      current?.currentPeriodEnd ??
      null;
    const data = {
      planId: session.planId,
      status,
      provider: PROVIDER,
      providerRef: preapproval.id,
      currentPeriodEnd: periodEnd,
      trialEndsAt: trial ? firstChargeAt : null,
      canceledAt: null,
    };
    await this.prisma.$transaction([
      this.prisma.subscription.upsert({
        where: { userId: session.userId },
        create: { userId: session.userId, ...data },
        update: data,
      }),
      this.prisma.checkoutSession.update({
        where: { id: session.id },
        data: { status: 'AUTHORIZED' },
      }),
      // O teste grátis vale uma vez: marca na primeira autorização com teste
      ...(session.trialDays > 0
        ? [
            this.prisma.user.updateMany({
              where: { id: session.userId, trialUsedAt: null },
              data: { trialUsedAt: new Date() },
            }),
          ]
        : []),
    ]);
    return true;
  }

  /** Registra (ou atualiza) uma cobrança da assinatura e reflete no status. */
  async recordAuthorizedPayment(id: string): Promise<boolean> {
    const charge = await this.mp.getAuthorizedPayment(id);
    const session = await this.prisma.checkoutSession.findUnique({
      where: { providerRef: charge.preapproval_id },
      select: { userId: true, plan: { select: { name: true } }, user: { select: { email: true } } },
    });
    if (!session) return false;

    const status = paymentStatusFrom(charge.payment?.status ?? charge.status);
    const amount = fromCents(Math.round(Number(charge.transaction_amount) * 100));
    await this.prisma.payment.upsert({
      where: { providerPaymentId: String(charge.id) },
      create: {
        userId: session.userId,
        provider: PROVIDER,
        providerPaymentId: String(charge.id),
        providerRef: charge.preapproval_id,
        amount,
        status,
        description: `Assinatura ${session.plan.name}`,
        payerEmail: session.user.email,
        paidAt:
          status === PaymentStatus.APPROVED ? new Date(charge.debit_date ?? Date.now()) : null,
      },
      update: {
        status,
        paidAt:
          status === PaymentStatus.APPROVED ? new Date(charge.debit_date ?? Date.now()) : null,
      },
    });

    // A data da próxima cobrança vem da assinatura
    await this.syncPreapproval(charge.preapproval_id);
    if (status === PaymentStatus.REJECTED) {
      await this.prisma.subscription.updateMany({
        where: {
          userId: session.userId,
          providerRef: charge.preapproval_id,
          NOT: { status: SubscriptionStatus.CANCELED },
        },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
    }
    return true;
  }

  async adminSummary(): Promise<AdminBillingDto> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [revenue, approved, failed, trialing, active, pastDue, events] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.APPROVED, paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({
        where: { status: PaymentStatus.APPROVED, paidAt: { gte: monthStart } },
      }),
      this.prisma.payment.count({
        where: { status: PaymentStatus.REJECTED, createdAt: { gte: monthStart } },
      }),
      this.prisma.subscription.count({
        where: { provider: PROVIDER, status: SubscriptionStatus.TRIALING },
      }),
      this.prisma.subscription.count({
        where: { provider: PROVIDER, status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.subscription.count({
        where: { provider: PROVIDER, status: SubscriptionStatus.PAST_DUE },
      }),
      this.prisma.webhookEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          resourceId: true,
          status: true,
          error: true,
          createdAt: true,
        },
      }),
    ]);
    const token = this.config.mercadoPago.accessToken;
    const publicUrl = this.config.apiPublicUrl;
    return {
      configured: Boolean(token),
      mode: token ? (this.config.mercadoPago.testMode ? 'test' : 'production') : null,
      webhookUrl: publicUrl ? `${publicUrl}/api/v1/billing/webhooks/mercadopago` : null,
      webhookSecretConfigured: Boolean(this.config.mercadoPago.webhookSecret),
      revenueMonthCents: toCents(revenue._sum.amount?.toString() ?? '0'),
      approvedMonth: approved,
      failedMonth: failed,
      trialing,
      active,
      pastDue,
      events: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    };
  }

  async adminPayments(query: AdminPaymentsQuery): Promise<PageDto<AdminPaymentDto>> {
    const where: Prisma.PaymentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { payerEmail: { contains: query.q } },
              { providerPaymentId: { contains: query.q } },
              { user: { name: { contains: query.q } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          amount: true,
          status: true,
          description: true,
          paidAt: true,
          createdAt: true,
          payerEmail: true,
          providerPaymentId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);
    return {
      page: query.page,
      pageSize: PAGE_SIZE,
      total,
      items: rows.map((row) => ({
        ...this.toPaymentDto(row),
        user: row.user,
        payerEmail: row.payerEmail,
        providerPaymentId: row.providerPaymentId,
      })),
    };
  }

  private async findSession(preapproval: MpPreapproval) {
    const select = { id: true, userId: true, planId: true, trialDays: true } as const;
    const byRef = await this.prisma.checkoutSession.findUnique({
      where: { providerRef: preapproval.id },
      select,
    });
    if (byRef) return byRef;
    // A sessão é criada antes da resposta do Mercado Pago; o external_reference cobre esse intervalo
    const ref = preapproval.external_reference;
    if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) return null;
    return this.prisma.checkoutSession.findUnique({ where: { id: ref }, select });
  }

  private async logEvent(event: {
    requestId: string | null;
    type: string;
    resourceId: string | undefined;
    status: string;
    error?: string;
  }): Promise<string> {
    const data = {
      provider: PROVIDER,
      type: event.type.slice(0, 60),
      resourceId: event.resourceId?.slice(0, 100) ?? null,
      status: event.status,
      error: event.error ?? null,
    };
    if (event.requestId) {
      const saved = await this.prisma.webhookEvent.upsert({
        where: { requestId: event.requestId },
        create: { ...data, requestId: event.requestId },
        update: data,
        select: { id: true },
      });
      return saved.id;
    }
    // Sem x-request-id (ou aviso rejeitado): id local. No SQL Server, uma coluna
    // única aceita só um NULL, e o segundo aviso assim falharia
    const saved = await this.prisma.webhookEvent.create({
      data: { ...data, requestId: `local:${randomUUID()}` },
      select: { id: true },
    });
    return saved.id;
  }

  private toPaymentDto(row: {
    id: string;
    amount: { toString(): string };
    status: string;
    description: string;
    paidAt: Date | null;
    createdAt: Date;
  }): PaymentDto {
    return {
      id: row.id,
      amountCents: toCents(row.amount.toString()),
      status: row.status as PaymentDto['status'],
      description: row.description,
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
