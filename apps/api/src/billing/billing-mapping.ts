import { PaymentStatus, SubscriptionStatus } from '@financeiro/shared';

/** Dias de tolerância depois da data da próxima cobrança antes de cortar o plano. */
export const GRACE_DAYS = 3;

/**
 * Status da assinatura (preapproval) no Mercado Pago -> status no sistema.
 * `firstChargeAt` é quando a primeira cobrança acontece (fim do teste grátis).
 * null = nada a mudar (assinatura ainda pendente de cartão).
 */
export function subscriptionStatusFrom(
  providerStatus: string,
  options: { firstChargeAt: Date | null; hasApprovedPayment: boolean; now?: Date },
): SubscriptionStatus | null {
  const now = options.now ?? new Date();
  switch (providerStatus) {
    case 'authorized':
      return options.firstChargeAt && now < options.firstChargeAt && !options.hasApprovedPayment
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.ACTIVE;
    case 'paused':
      return SubscriptionStatus.PAST_DUE;
    case 'cancelled':
      return SubscriptionStatus.CANCELED;
    default:
      return null;
  }
}

/** Status do pagamento no Mercado Pago -> status no sistema. */
export function paymentStatusFrom(providerStatus: string | undefined): PaymentStatus {
  switch (providerStatus) {
    case 'approved':
      return PaymentStatus.APPROVED;
    case 'rejected':
    case 'cancelled':
      return PaymentStatus.REJECTED;
    case 'refunded':
    case 'charged_back':
      return PaymentStatus.REFUNDED;
    default:
      return PaymentStatus.PENDING;
  }
}

/** Fim do período pago: a próxima cobrança mais a tolerância. */
export function periodEndFrom(nextPaymentDate: string | null | undefined): Date | null {
  if (!nextPaymentDate) return null;
  const next = new Date(nextPaymentDate);
  if (Number.isNaN(next.getTime())) return null;
  const end = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()));
  end.setUTCDate(end.getUTCDate() + GRACE_DAYS);
  return end;
}
