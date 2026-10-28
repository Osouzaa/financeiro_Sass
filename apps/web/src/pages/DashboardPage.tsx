import {
  addDays,
  formatBRL,
  monthBounds,
  todayIso,
  type TransactionSummaryDto,
} from '@financeiro/shared';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  CreditCard,
  Landmark,
  Plus,
  type LucideIcon,
  CircleAlert,
} from 'lucide-react';
import { Link } from 'react-router';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/features/auth/auth-context';
import { useBudgetMonth } from '@/features/budget/budget-api';
import { ProjectionChart } from '@/features/projection/ProjectionChart';
import { useProjection } from '@/features/projection/projection-api';
import { PageHeader } from '@/layout/AppLayout';
import { useAccounts } from '@/features/accounts/account-meta';
import { categoryIcon } from '@/features/categories/category-icons';
import { useInvoices } from '@/features/invoices/invoice-api';
import { useRecurrences } from '@/features/recurrences/recurrence-api';
import { useTransactions } from '@/features/transactions/transaction-api';
import { formatShortDate } from '@/lib/dates';

const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
  new Date(),
);

const FIRST_STEPS = [
  { title: 'Cadastre suas contas e cartões', to: '/contas' },
  { title: 'Registre as recorrências', to: '/recorrencias' },
  { title: 'Lance os gastos do mês', to: '/lancamentos' },
  { title: 'Defina o orçamento por categoria', to: '/orcamento' },
];

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0];
  const { data: accounts = [] } = useAccounts();
  const { data: month } = useTransactions(monthBounds(todayIso().slice(0, 7)));
  const summary = month?.summary;
  const hasTransactions = (month?.items.length ?? 0) > 0;
  const { data: recurrences = [] } = useRecurrences();
  const { data: budget } = useBudgetMonth(todayIso().slice(0, 7));

  const cash = accounts.filter((a) => a.type !== 'CREDIT_CARD');
  const cards = accounts.filter((a) => a.type === 'CREDIT_CARD');
  const balance = cash.reduce((sum, a) => sum + a.balanceCents, 0);
  const owed = cards.reduce((sum, a) => sum + a.balanceCents, 0);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const plannedNote = (planned: number, fallback: string) =>
    planned > 0 ? `${formatBRL(planned)} ainda previsto` : fallback;

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description={`Resumo de ${monthLabel}.`}
        actions={
          <Link
            to="/lancamentos?novo=despesa"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-graphite px-4 text-sm font-medium text-white transition-colors hover:bg-black"
          >
            <Plus size={18} aria-hidden="true" /> Novo lançamento
          </Link>
        }
      />

      <section aria-label="Indicadores do mês" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Landmark}
          label="Saldo em contas"
          value={balance}
          note={
            cash.length
              ? `Em ${plural(cash.length, 'conta', 'contas')}`
              : 'Nenhuma conta cadastrada'
          }
          to="/contas"
        />
        <StatCard
          icon={ArrowDownLeft}
          label="Receitas do mês"
          value={summary?.incomeCents ?? 0}
          note={plannedNote(summary?.plannedIncomeCents ?? 0, 'Realizado + previsto')}
          tone="positive"
          to="/lancamentos?tipo=INCOME"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Despesas do mês"
          value={summary?.expenseCents ?? 0}
          note={plannedNote(summary?.plannedExpenseCents ?? 0, 'Por data da compra')}
          tone="negative"
          to="/lancamentos?tipo=EXPENSE"
        />
        <StatCard
          icon={CreditCard}
          label="Faturas em aberto"
          value={owed}
          note={cards.length ? `Em ${plural(cards.length, 'cartão', 'cartões')}` : 'Nenhum cartão'}
          to={cards.length ? '/faturas' : '/contas'}
        />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ProjectionCard hasAccounts={accounts.length > 0} />
        <FirstStepsCard
          hasAccounts={accounts.length > 0}
          hasRecurrences={recurrences.length > 0}
          hasTransactions={hasTransactions}
          hasBudget={(budget?.items.length ?? 0) > 0}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CategoriesCard summary={summary} />
        <UpcomingCard />
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone = 'neutral',
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  note: string;
  tone?: 'neutral' | 'positive' | 'negative';
  /** Página com o detalhe do indicador; torna o card clicável. */
  to?: string;
}) {
  const chip = {
    neutral: 'bg-sunken text-steel',
    positive: 'bg-positive-soft text-positive',
    negative: 'bg-negative-soft text-negative',
  }[tone];
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate">{label}</span>
        <span className={`grid size-9 place-items-center rounded-[10px] ${chip}`}>
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p
        className={`tabular mt-3 font-display text-[28px] leading-none font-semibold tracking-[-0.02em] ${
          value < 0 && tone === 'neutral' ? 'text-negative' : ''
        }`}
      >
        {formatBRL(value)}
      </p>
      <p className="mt-2 text-[13px] text-faint">{note}</p>
    </>
  );
  return to ? (
    <Link to={to} className="card block p-5 transition-colors hover:border-line-strong">
      {content}
    </Link>
  ) : (
    <div className="card p-5">{content}</div>
  );
}

function ProjectionCard({ hasAccounts }: { hasAccounts: boolean }) {
  const { data: projection } = useProjection(30);
  const hasMovement = (projection?.events.length ?? 0) > 0;

  return (
    <section
      aria-labelledby="titulo-projecao"
      className="card relative overflow-hidden p-6 xl:col-span-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-projecao" className="text-lg font-semibold">
            Projeção de saldo
          </h2>
          <p className="text-sm text-slate">Saldo previsto dia a dia nos próximos 30 dias</p>
        </div>
        <Link to="/projecao" className="link-ember text-sm">
          Ver projeção completa
        </Link>
      </div>

      {projection && hasAccounts ? (
        <>
          <dl className="mt-5 grid grid-cols-3 gap-3">
            <ProjectionFigure label="Hoje" value={projection.startBalanceCents} />
            <ProjectionFigure
              label={`Em ${formatShortDate(projection.to)}`}
              value={projection.endBalanceCents}
            />
            <ProjectionFigure
              label={`Menor · ${formatShortDate(projection.lowest.date)}`}
              value={projection.lowest.balanceCents}
            />
          </dl>
          {projection.firstNegativeDate ? (
            <p
              role="status"
              className="mt-4 flex items-center gap-2 rounded-[10px] bg-negative-soft px-3 py-2 text-sm text-negative"
            >
              <CircleAlert size={16} aria-hidden="true" />O saldo fica negativo em{' '}
              {formatShortDate(projection.firstNegativeDate)}.
            </p>
          ) : null}
          <div className="mt-4">
            <ProjectionChart projection={projection} height={220} />
          </div>
          {!hasMovement ? (
            <p className="mt-2 text-center text-sm text-slate">
              Sem nada previsto: cadastre{' '}
              <Link to="/recorrencias" className="link-ember">
                recorrências
              </Link>{' '}
              para a curva ganhar forma.
            </p>
          ) : null}
        </>
      ) : (
        <div className="mt-6 grid h-[260px] place-items-center rounded-[12px] border border-dashed border-line-strong text-center">
          <div className="max-w-sm px-6">
            <p className="font-semibold">Sua projeção aparece aqui</p>
            <p className="mt-1 text-sm text-slate">
              Cadastre uma conta e suas recorrências para ver quanto vai sobrar no fim do mês.
            </p>
            <Link to="/contas" className="link-ember mt-3 inline-block text-sm">
              Cadastrar primeira conta
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function ProjectionFigure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] bg-canvas px-3 py-2.5">
      <dt className="truncate text-[12px] text-slate">{label}</dt>
      <dd
        className={`tabular font-display text-lg font-semibold sm:text-xl ${value < 0 ? 'text-negative' : ''}`}
      >
        {formatBRL(value)}
      </dd>
    </div>
  );
}

function FirstStepsCard({
  hasAccounts,
  hasRecurrences,
  hasTransactions,
  hasBudget,
}: {
  hasAccounts: boolean;
  hasRecurrences: boolean;
  hasTransactions: boolean;
  hasBudget: boolean;
}) {
  const completed = [hasAccounts, hasRecurrences, hasTransactions, hasBudget];
  const done = completed.filter(Boolean).length;
  return (
    <section aria-labelledby="titulo-passos" className="card p-6">
      <h2 id="titulo-passos" className="text-lg font-semibold">
        Primeiros passos
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-ember"
            style={{ width: `${(done / FIRST_STEPS.length) * 100}%` }}
          />
        </div>
        <span className="tabular text-[13px] text-slate">
          {done} de {FIRST_STEPS.length}
        </span>
      </div>
      <ol className="mt-5 space-y-1">
        {FIRST_STEPS.map((step, index) => (
          <li key={step.to}>
            <Link
              to={step.to}
              className="group flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-sunken"
            >
              <span className="tabular grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-[12px] text-slate group-hover:border-ember group-hover:text-ember">
                {completed[index] ? <Check size={14} /> : index + 1}
              </span>
              <span className="text-sm">{step.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CategoriesCard({ summary }: { summary?: TransactionSummaryDto }) {
  const all = summary?.expensesByCategory ?? [];
  const top = all.slice(0, 5);
  const rest = all.slice(5).reduce((sum, category) => sum + category.totalCents, 0);
  const slices = [
    ...top.map((category) => ({
      key: category.categoryId,
      name: category.name,
      icon: category.icon,
      color: category.color ?? '#a3a3a8',
      value: category.totalCents,
    })),
    ...(rest > 0
      ? [{ key: 'outras', name: 'Outras', icon: null, color: '#d4d0c8', value: rest }]
      : []),
  ];
  const total = summary?.expenseCents ?? 0;

  return (
    <section aria-labelledby="titulo-categorias" className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="titulo-categorias" className="text-lg font-semibold">
            Gastos por categoria
          </h2>
          <p className="text-sm text-slate">Distribuição das despesas do mês</p>
        </div>
        <Link to="/lancamentos?tipo=EXPENSE" className="link-ember text-sm">
          Ver despesas
        </Link>
      </div>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative size-[160px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices.length ? slices : [{ key: 'vazio', value: 1, color: '#f1efea' }]}
                dataKey="value"
                nameKey="key"
                innerRadius={56}
                outerRadius={76}
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="none"
                isAnimationActive={false}
              >
                {(slices.length ? slices : [{ key: 'vazio', color: '#f1efea' }]).map((slice) => (
                  <Cell key={slice.key} fill={slice.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="tabular font-display text-lg font-semibold">{formatBRL(total)}</p>
              <p className="text-[12px] text-faint">no mês</p>
            </div>
          </div>
        </div>
        {slices.length === 0 ? (
          <p className="flex-1 text-center text-sm text-slate sm:text-left">
            Quando você lançar despesas, a distribuição por categoria aparece aqui.
          </p>
        ) : (
          <ul className="w-full flex-1 divide-y divide-line">
            {slices.map((slice) => {
              const Icon = categoryIcon(slice.icon);
              return (
                <li key={slice.key} className="flex items-center gap-3 py-2.5 text-sm">
                  <span
                    className="grid size-6 place-items-center rounded-full"
                    style={{ background: `${slice.color}22`, color: slice.color }}
                    aria-hidden="true"
                  >
                    <Icon size={13} />
                  </span>
                  <span className="flex-1 truncate">{slice.name}</span>
                  <span className="tabular text-[12px] text-faint">
                    {total > 0 ? Math.round((slice.value / total) * 100) : 0}%
                  </span>
                  <span className="tabular w-24 text-right text-steel">
                    {formatBRL(slice.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

interface UpcomingEntry {
  key: string;
  date: string;
  title: string;
  subtitle: string;
  amountCents: number;
  incoming: boolean;
  overdue: boolean;
  to: string;
}

function UpcomingCard() {
  const today = todayIso();
  const limit = addDays(today, 7);
  const { data, isPending } = useTransactions({ from: today, to: limit, status: 'PLANNED' });
  const { data: invoices = [] } = useInvoices({ unpaid: true });

  const entries: UpcomingEntry[] = [
    // Compras no cartão são cobradas pela fatura, que entra abaixo com o valor total
    ...(data?.items ?? [])
      .filter((item) => !item.invoice)
      .map((item) => ({
        key: item.id,
        date: item.date,
        title: item.description,
        subtitle: item.account.name,
        amountCents: item.amountCents,
        incoming: item.type === 'INCOME' || item.transfer?.direction === 'IN',
        overdue: false,
        to: '/lancamentos?status=PLANNED',
      })),
    // Faturas vencidas ou que vencem na semana, descontando o que já está agendado
    ...invoices
      .filter((invoice) => invoice.dueDate <= limit)
      .map((invoice) => ({ invoice, due: invoice.remainingCents - invoice.scheduledCents }))
      .filter(({ due }) => due > 0)
      .map(({ invoice, due }) => ({
        key: invoice.id,
        date: invoice.dueDate,
        title: `Fatura ${invoice.account.name}`,
        subtitle: invoice.overdue
          ? 'Vencida'
          : invoice.status === 'OPEN'
            ? 'Ainda aberta'
            : 'Fechada',
        amountCents: due,
        incoming: false,
        overdue: invoice.overdue,
        to: `/faturas?cartao=${invoice.account.id}&fatura=${invoice.id}`,
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <section aria-labelledby="titulo-vencimentos" className="card flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="titulo-vencimentos" className="text-lg font-semibold">
            Próximos vencimentos
          </h2>
          <p className="text-sm text-slate">Contas e faturas dos próximos 7 dias</p>
        </div>
        {entries.length ? (
          <Link to="/lancamentos?status=PLANNED" className="link-ember text-sm">
            Ver previstos
          </Link>
        ) : null}
      </div>
      {isPending ? null : entries.length === 0 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-[12px] border border-dashed border-line-strong px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-ember-soft text-ember-deep">
            <CalendarClock size={22} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="mt-4 font-medium">Nenhum vencimento por perto</p>
          <p className="mt-1 max-w-[36ch] text-sm text-slate">
            Lançamentos previstos e faturas dos próximos dias aparecem aqui com a data e o valor.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {entries.map((entry) => (
            <li key={entry.key}>
              <Link
                to={entry.to}
                className="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-3 transition-colors hover:bg-sunken"
              >
                <span
                  className={`tabular grid w-12 shrink-0 place-items-center rounded-[10px] py-1.5 text-center text-[12px] leading-tight font-semibold ${
                    entry.overdue
                      ? 'bg-negative-soft text-negative'
                      : entry.date === today
                        ? 'bg-ember-soft text-ember-deep'
                        : 'bg-sunken text-steel'
                  }`}
                >
                  {entry.date === today ? 'Hoje' : formatShortDate(entry.date)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{entry.title}</span>
                  <span
                    className={`block truncate text-[12px] ${
                      entry.overdue ? 'text-negative' : 'text-slate'
                    }`}
                  >
                    {entry.subtitle}
                  </span>
                </span>
                <span
                  className={`tabular text-sm font-semibold ${
                    entry.incoming ? 'text-positive' : ''
                  }`}
                >
                  {entry.incoming ? '+' : '−'}
                  {formatBRL(entry.amountCents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
