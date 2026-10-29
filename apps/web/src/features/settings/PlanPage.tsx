import {
  formatBRL,
  paymentStatusLabels,
  type CheckoutDto,
  type MyPlanDto,
  type PaymentDto,
  type PlanDto,
  type PlanLimits,
} from '@financeiro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, CircleCheck, LoaderCircle, Minus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button, FormAlert } from '@/components/form';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { formatPlanPrice, useMyPlan, usePublicPlans } from '@/features/plans/plan-api';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/dates';

type Counted = 'maxAccounts' | 'maxCards' | 'maxRecurrences' | 'maxBudgets';

const USAGE: { limit: Counted; label: string; key: keyof MyPlanDto['usage'] }[] = [
  { limit: 'maxAccounts', label: 'Contas e carteiras', key: 'accounts' },
  { limit: 'maxCards', label: 'Cartões de crédito', key: 'cards' },
  { limit: 'maxRecurrences', label: 'Recorrências ativas', key: 'recurrences' },
  { limit: 'maxBudgets', label: 'Categorias com orçamento', key: 'budgets' },
];

/** Linhas da comparação: o mesmo recurso em todos os planos, na mesma altura. */
const ROWS: { label: string; value: (limits: PlanLimits, plan: PlanDto) => string | boolean }[] = [
  { label: 'Lançamentos', value: () => 'Ilimitados' },
  {
    label: 'Contas e carteiras',
    value: (l) => (l.maxAccounts === null ? 'Ilimitadas' : String(l.maxAccounts)),
  },
  {
    label: 'Cartões de crédito',
    value: (l) => (l.maxCards === null ? 'Ilimitados' : String(l.maxCards)),
  },
  {
    label: 'Recorrências ativas',
    value: (l) => (l.maxRecurrences === null ? 'Ilimitadas' : String(l.maxRecurrences)),
  },
  {
    label: 'Categorias com orçamento',
    value: (l) => (l.maxBudgets === null ? 'Todas' : `Até ${l.maxBudgets}`),
  },
  {
    label: 'Projeção de saldo',
    value: (l) => (l.projectionDays >= 365 ? '1 ano' : `${l.projectionDays} dias`),
  },
  { label: 'Assistente no WhatsApp', value: (l) => (l.whatsapp ? 'Em breve' : false) },
];

/** Assinatura que ainda cobra: não deixa assinar outra por cima. */
const LIVE = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

/** Só sai do app para o Mercado Pago (https), ou para o simulador local em desenvolvimento. */
function isSafeCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (import.meta.env.DEV && url.hostname === 'localhost');
  } catch {
    return false;
  }
}

export function PlanPage() {
  const { data, isPending } = useMyPlan();
  const { data: plans = [] } = usePublicPlans();
  const returning = useReturnFromCheckout();
  const [canceling, setCanceling] = useState(false);

  if (isPending || !data) {
    return <div className="card h-[320px] animate-pulse bg-sunken/40" aria-hidden="true" />;
  }
  const { subscription } = data;
  const live = Boolean(
    subscription?.provider === 'MERCADO_PAGO' && LIVE.includes(subscription.status),
  );

  return (
    <div className="flex flex-col gap-8">
      {returning ? <ReturnNotice state={returning} /> : null}
      <CurrentPlan data={data} live={live} onCancel={() => setCanceling(true)} />
      <Comparison plans={plans} data={data} live={live} />
      <Payments />
      {canceling ? (
        <CancelModal
          until={subscription?.currentPeriodEnd ?? null}
          planName={data.plan.name}
          onClose={() => setCanceling(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ Plano atual */

function statusLine({ plan, subscription }: MyPlanDto): string {
  if (!subscription || plan.priceCents === 0) {
    return 'Plano gratuito, sem prazo. Troque quando precisar de mais.';
  }
  const until = subscription.currentPeriodEnd
    ? formatShortDate(subscription.currentPeriodEnd)
    : null;
  switch (subscription.status) {
    case 'TRIALING':
      return subscription.trialEndsAt
        ? `Teste grátis até ${formatShortDate(subscription.trialEndsAt)}. A primeira cobrança de ${formatPlanPrice(plan)} é nesse dia.`
        : 'Em teste grátis.';
    case 'CANCELED':
      return until
        ? `Assinatura cancelada. Você usa o ${plan.name} até ${until} e depois volta para o Grátis.`
        : 'Assinatura cancelada.';
    case 'PAST_DUE':
      return 'A última cobrança foi recusada.';
    default:
      return until
        ? `${formatPlanPrice(plan)}. Próxima renovação em ${until}.`
        : formatPlanPrice(plan);
  }
}

function CurrentPlan({
  data,
  live,
  onCancel,
}: {
  data: MyPlanDto;
  live: boolean;
  onCancel: () => void;
}) {
  const { plan, subscription, usage } = data;
  const atLimit = USAGE.some(({ limit, key }) => {
    const max = plan.limits[limit];
    return max !== null && usage[key] >= max;
  });

  return (
    <section
      aria-labelledby="titulo-plano-atual"
      className="card grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12"
    >
      <div className="flex flex-col">
        <p className="text-sm text-slate">Seu plano</p>
        <h2
          id="titulo-plano-atual"
          className="mt-1 font-display text-[32px] leading-tight font-semibold tracking-[-0.02em]"
        >
          {plan.name}
        </h2>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.6] text-steel">{statusLine(data)}</p>

        {subscription?.status === 'PAST_DUE' && subscription.provider === 'MERCADO_PAGO' ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-[12px] bg-negative-soft px-4 py-3 text-sm text-negative"
          >
            <CircleAlert size={18} className="mt-px shrink-0" aria-hidden="true" />
            Atualize o cartão na sua conta do Mercado Pago para não perder o plano
            {subscription.currentPeriodEnd
              ? ` em ${formatShortDate(subscription.currentPeriodEnd)}`
              : ''}
            .
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-6">
          {live ? (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancelar assinatura
            </Button>
          ) : (
            <a
              href="#comparar-planos"
              className="inline-flex h-10 items-center rounded-[10px] border border-line-strong px-4 text-sm font-medium hover:bg-sunken"
            >
              Comparar planos
            </a>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Uso do plano</p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {USAGE.map(({ limit, label, key }) => (
            <UsageRow key={key} label={label} used={usage[key]} max={plan.limits[limit]} />
          ))}
          <li className="flex items-center justify-between gap-4 py-3 text-[15px]">
            <span className="text-steel">Projeção de saldo</span>
            <span className="tabular font-medium">
              {plan.limits.projectionDays >= 365 ? '1 ano' : `${plan.limits.projectionDays} dias`}
            </span>
          </li>
        </ul>
        {atLimit && plan.priceCents === 0 ? (
          <p className="mt-3 text-sm text-steel">
            Você chegou a um limite do Grátis.{' '}
            <a href="#comparar-planos" className="link-ember">
              Veja o que o Pro libera
            </a>
            .
          </p>
        ) : null}
      </div>
    </section>
  );
}

function UsageRow({ label, used, max }: { label: string; used: number; max: number | null }) {
  const full = max !== null && used >= max;
  const share = max ? Math.min(100, (used / max) * 100) : 0;
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-4 text-[15px]">
        <span className="text-steel">{label}</span>
        <span className={`tabular font-medium ${full ? 'text-negative' : ''}`}>
          {max === null ? `${used}, sem limite` : `${used} de ${max}`}
        </span>
      </div>
      {max !== null ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
          <div
            className={`h-full rounded-full ${full ? 'bg-negative' : 'bg-graphite'}`}
            style={{ width: `${share}%` }}
          />
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------ Comparação */

function Comparison({ plans, data, live }: { plans: PlanDto[]; data: MyPlanDto; live: boolean }) {
  const { billing } = data;
  return (
    <section aria-labelledby="titulo-comparar" id="comparar-planos" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="titulo-comparar"
            className="font-display text-[24px] font-semibold tracking-[-0.015em]"
          >
            Planos
          </h2>
          <p className="mt-1 max-w-[60ch] text-[15px] text-steel">
            {billing.enabled
              ? 'Pagamento no cartão de crédito, pelo Mercado Pago, com renovação automática. Cancele quando quiser.'
              : 'O pagamento ainda não está ativo nesta instalação.'}
          </p>
        </div>
      </div>

      {/* Computador: colunas com as mesmas linhas; celular: um card por plano */}
      <div className="card mt-5 hidden overflow-hidden md:block">
        <table className="w-full table-fixed text-left text-[15px]">
          <caption className="sr-only">Comparação dos planos</caption>
          <colgroup>
            <col className="w-[30%]" />
            {plans.map((plan) => (
              <col key={plan.id} />
            ))}
          </colgroup>
          <thead>
            <tr className="align-top">
              <td className="p-6" />
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={`p-6 font-normal ${plan.id === data.plan.id ? 'bg-canvas' : ''}`}
                >
                  <PlanHeader plan={plan} data={data} live={live} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-6 py-3.5 font-normal text-steel">
                  {row.label}
                </th>
                {plans.map((plan) => (
                  <td
                    key={plan.id}
                    className={`tabular px-6 py-3.5 ${plan.id === data.plan.id ? 'bg-canvas' : ''}`}
                  >
                    <Cell value={row.value(plan.limits, plan)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-5 grid gap-4 md:hidden">
        {plans.map((plan) => (
          <li
            key={plan.id}
            className={`card p-5 ${plan.id === data.plan.id ? 'border-graphite' : ''}`}
          >
            <PlanHeader plan={plan} data={data} live={live} />
            <dl className="mt-5 divide-y divide-line border-t border-line text-[15px]">
              {ROWS.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-steel">{row.label}</dt>
                  <dd className="tabular">
                    <Cell value={row.value(plan.limits, plan)} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={18} className="text-positive" aria-label="Incluso" />;
  if (value === false) return <Minus size={18} className="text-faint" aria-label="Não incluso" />;
  return <>{value}</>;
}

function PlanHeader({ plan, data, live }: { plan: PlanDto; data: MyPlanDto; live: boolean }) {
  const notify = useToast();
  const current = plan.id === data.plan.id;
  const paid = plan.priceCents > 0;
  const withTrial = data.billing.trialAvailable && plan.trialDays > 0;
  const [price, period] = formatPlanPrice(plan).split('/');
  const checkout = useMutation({
    mutationFn: () =>
      api<CheckoutDto>('/billing/checkout', { method: 'POST', body: { planId: plan.id } }),
    onSuccess: ({ url }) => {
      if (!isSafeCheckoutUrl(url)) {
        notify('Endereço de pagamento inesperado. Tente de novo.', 'error');
        return;
      }
      window.location.assign(url);
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const hint = !paid
    ? current
      ? null
      : 'A conta volta para ele se a assinatura acabar.'
    : current
      ? null
      : !data.billing.enabled
        ? 'Pagamento ainda não disponível.'
        : live
          ? 'Cancele a assinatura atual para trocar.'
          : withTrial
            ? `Cobrança só no ${plan.trialDays + 1}º dia.`
            : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-[20px] font-semibold">{plan.name}</p>
        {current ? <span className="text-sm font-medium text-steel">Seu plano</span> : null}
      </div>
      <p className="mt-1 text-sm leading-[1.5] text-slate">{plan.description}</p>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="tabular font-display text-[32px] leading-none font-semibold tracking-[-0.02em]">
          {price}
        </span>
        {period ? <span className="text-sm text-slate">por {period}</span> : null}
      </p>
      {paid && withTrial ? (
        <p className="mt-1.5 text-sm font-medium text-positive">
          {plan.trialDays} dias grátis para experimentar
        </p>
      ) : null}
      <div className="mt-5">
        {current ? (
          <span className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-sunken text-sm font-medium text-steel">
            Plano atual
          </span>
        ) : paid ? (
          <Button
            type="button"
            className="w-full"
            disabled={!data.billing.enabled || live}
            loading={checkout.isPending}
            onClick={() => checkout.mutate()}
          >
            {withTrial ? `Começar ${plan.trialDays} dias grátis` : `Assinar o ${plan.name}`}
          </Button>
        ) : null}
        {hint ? <p className="mt-2 text-[13px] leading-[1.5] text-slate">{hint}</p> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Cobranças */

function Payments() {
  const { data: payments = [] } = useQuery({
    queryKey: ['me-payments'],
    queryFn: () => api<PaymentDto[]>('/billing/payments'),
  });
  if (payments.length === 0) return null;
  const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
  return (
    <section aria-labelledby="titulo-cobrancas">
      <h2
        id="titulo-cobrancas"
        className="font-display text-[24px] font-semibold tracking-[-0.015em]"
      >
        Cobranças
      </h2>
      <ul className="card mt-5 divide-y divide-line">
        {payments.map((payment) => (
          <li
            key={payment.id}
            className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 text-[15px] sm:grid-cols-[100px_minmax(0,1fr)_120px_140px]"
          >
            <span className="tabular text-slate">
              {when.format(new Date(payment.paidAt ?? payment.createdAt))}
            </span>
            <span className="truncate">{payment.description}</span>
            <span className="tabular text-right font-medium">{formatBRL(payment.amountCents)}</span>
            <span
              className={`col-span-3 text-sm sm:col-span-1 sm:text-right ${
                payment.status === 'APPROVED'
                  ? 'text-positive'
                  : payment.status === 'REJECTED'
                    ? 'text-negative'
                    : 'text-slate'
              }`}
            >
              {paymentStatusLabels[payment.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------ Volta do checkout e cancelamento */

type ReturnState = 'checking' | 'done' | 'pending';

/** Na volta do Mercado Pago (?assinatura=retorno), confere o status direto com eles. */
function useReturnFromCheckout(): ReturnState | null {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ReturnState | null>(
    params.get('assinatura') === 'retorno' ? 'checking' : null,
  );
  const started = useRef(false);

  useEffect(() => {
    if (state !== 'checking' || started.current) return;
    started.current = true;
    setParams({}, { replace: true });
    void api('/billing/sync', { method: 'POST' })
      .catch(() => undefined)
      .then(() =>
        queryClient.fetchQuery({
          queryKey: ['me-plan'],
          queryFn: () => api<MyPlanDto>('/me/plan'),
        }),
      )
      .then((plan) => {
        void queryClient.invalidateQueries({ queryKey: ['me-plan'] });
        setState(
          plan?.subscription?.provider === 'MERCADO_PAGO' && LIVE.includes(plan.subscription.status)
            ? 'done'
            : 'pending',
        );
      })
      .catch(() => setState('pending'));
  }, [state, setParams, queryClient]);

  return state;
}

function ReturnNotice({ state }: { state: ReturnState }) {
  if (state === 'checking') {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm text-steel"
      >
        <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
        Confirmando sua assinatura com o Mercado Pago…
      </p>
    );
  }
  return state === 'done' ? (
    <p
      role="status"
      className="flex items-center gap-2 rounded-[12px] border border-positive/25 bg-positive-soft px-4 py-3 text-sm text-positive"
    >
      <CircleCheck size={18} aria-hidden="true" />
      Assinatura confirmada. O plano já está liberado.
    </p>
  ) : (
    <p
      role="status"
      className="flex items-start gap-2 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm text-steel"
    >
      <CircleAlert size={18} className="mt-px shrink-0" aria-hidden="true" />
      Ainda não recebemos a confirmação do cartão. Se você concluiu no Mercado Pago, o plano é
      liberado em alguns minutos; recarregue esta página depois.
    </p>
  );
}

function CancelModal({
  until,
  planName,
  onClose,
}: {
  until: string | null;
  planName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const cancel = useMutation({
    mutationFn: () => api('/billing/cancel', { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me-plan'] });
      notify('Assinatura cancelada. Não haverá novas cobranças.');
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Cancelar a assinatura?"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Manter assinatura
          </Button>
          <Button
            type="button"
            loading={cancel.isPending}
            onClick={() => cancel.mutate()}
            className="!bg-negative hover:!bg-[#a92e26]"
          >
            Cancelar assinatura
          </Button>
        </>
      }
    >
      <FormAlert message={cancel.error?.message} />
      <p className="text-[15px] leading-relaxed text-steel">
        Não haverá novas cobranças. Você continua com o {planName}
        {until ? ` até ${formatShortDate(until)}` : ' até o fim do período já pago'}; depois a conta
        volta para o Grátis, com todos os seus dados.
      </p>
    </Modal>
  );
}
