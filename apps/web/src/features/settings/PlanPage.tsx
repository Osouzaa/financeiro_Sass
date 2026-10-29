import {
  subscriptionStatusLabels,
  type MyPlanDto,
  type PlanDto,
  type PlanLimits,
} from '@financeiro/shared';
import { Check, Crown, Infinity as InfinityIcon } from 'lucide-react';
import { formatPlanPrice, useMyPlan, usePublicPlans } from '@/features/plans/plan-api';
import { formatShortDate } from '@/lib/dates';
import { SettingsSection } from './SettingsLayout';

type Counted = 'maxAccounts' | 'maxCards' | 'maxRecurrences' | 'maxBudgets';

const USAGE: { limit: Counted; label: string; key: keyof MyPlanDto['usage'] }[] = [
  { limit: 'maxAccounts', label: 'Contas e carteiras', key: 'accounts' },
  { limit: 'maxCards', label: 'Cartões de crédito', key: 'cards' },
  { limit: 'maxRecurrences', label: 'Recorrências ativas', key: 'recurrences' },
  { limit: 'maxBudgets', label: 'Limites de orçamento no mês', key: 'budgets' },
];

export function PlanPage() {
  const { data, isPending } = useMyPlan();
  const { data: plans = [] } = usePublicPlans();

  if (isPending || !data) {
    return <div className="card h-[280px] animate-pulse bg-sunken/40" aria-hidden="true" />;
  }
  const { plan, subscription, usage } = data;

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Plano atual"
        description="O que está liberado na sua conta e quanto de cada limite você já usa."
      >
        <div className="flex flex-col gap-5">
          <div className="dot-grid flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-night p-5 text-white">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-[12px] bg-white/10 text-ember">
                <Crown size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-xl font-semibold">{plan.name}</p>
                <p className="text-sm text-white/60">
                  {formatPlanPrice(plan)}
                  {subscription
                    ? ` · ${subscriptionStatusLabels[subscription.status]}${
                        subscription.currentPeriodEnd
                          ? ` até ${formatShortDate(subscription.currentPeriodEnd)}`
                          : ''
                      }`
                    : ''}
                </p>
              </div>
            </div>
            <p className="text-sm text-white/70">
              Projeção de até {plan.limits.projectionDays} dias
              {plan.limits.whatsapp ? ' · WhatsApp incluso' : ''}
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {USAGE.map(({ limit, label, key }) => (
              <UsageBar key={key} label={label} used={usage[key]} max={plan.limits[limit]} />
            ))}
          </ul>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Planos"
        description="Compare o que cada plano oferece. O pagamento pelo Mercado Pago (Pix e cartão) chega na próxima etapa."
      >
        <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {plans.map((item) => (
            <PlanCard key={item.id} plan={item} current={item.id === plan.id} />
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number | null }) {
  const share = max ? Math.min(100, (used / max) * 100) : 0;
  const full = max !== null && used >= max;
  return (
    <li className="rounded-[12px] border border-line p-4">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-steel">{label}</span>
        <span className="tabular font-medium">
          {max === null ? (
            <span className="inline-flex items-center gap-1 text-positive">
              {used} <InfinityIcon size={15} aria-label="sem limite" />
            </span>
          ) : (
            `${used} de ${max}`
          )}
        </span>
      </div>
      {max !== null ? (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
            <div
              className={`h-full rounded-full ${full ? 'bg-negative' : 'bg-graphite'}`}
              style={{ width: `${share}%` }}
            />
          </div>
          {full ? (
            <p className="mt-1.5 text-[12px] font-medium text-negative">Limite atingido</p>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

const LIMIT_LINES: {
  key: keyof PlanLimits;
  text: (value: PlanLimits[keyof PlanLimits]) => string;
}[] = [
  { key: 'maxAccounts', text: (v) => (v === null ? 'Contas ilimitadas' : `${v} contas`) },
  {
    key: 'maxCards',
    text: (v) => (v === null ? 'Cartões ilimitados' : `${v} ${v === 1 ? 'cartão' : 'cartões'}`),
  },
  { key: 'projectionDays', text: (v) => `Projeção de ${v} dias` },
];

function PlanCard({ plan, current }: { plan: PlanDto; current: boolean }) {
  return (
    <li
      className={`relative flex flex-col rounded-[16px] border p-5 ${
        plan.highlighted ? 'border-ember ring-1 ring-ember' : 'border-line'
      }`}
    >
      {plan.highlighted ? (
        <span className="absolute -top-2.5 left-5 rounded-full bg-ember px-2.5 py-0.5 text-[11px] font-semibold text-white">
          Mais escolhido
        </span>
      ) : null}
      <p className="font-display text-lg font-semibold">{plan.name}</p>
      <p className="text-sm text-slate">{plan.description}</p>
      <p className="tabular mt-3 font-display text-2xl font-semibold">{formatPlanPrice(plan)}</p>
      <ul className="mt-4 flex-1 space-y-2 text-sm">
        {(plan.features.length
          ? plan.features
          : LIMIT_LINES.map((line) => line.text(plan.limits[line.key]))
        ).map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-positive" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-5">
        {current ? (
          <span className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-sunken text-sm font-medium text-steel">
            Seu plano atual
          </span>
        ) : (
          <button
            type="button"
            disabled
            title="Pagamento pelo Mercado Pago em breve"
            className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-[10px] border border-line-strong text-sm font-medium text-slate"
          >
            {plan.priceCents === 0 ? 'Plano gratuito' : 'Assinar em breve'}
          </button>
        )}
      </div>
    </li>
  );
}
