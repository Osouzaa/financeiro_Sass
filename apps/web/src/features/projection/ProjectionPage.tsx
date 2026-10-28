import { formatBRL, type ProjectionDto, type ProjectionEventDto } from '@financeiro/shared';
import {
  CircleAlert,
  CircleCheck,
  CreditCard,
  Landmark,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Select } from '@/components/inputs';
import { useAccounts } from '@/features/accounts/account-meta';
import { PageHeader } from '@/layout/AppLayout';
import { formatDayHeading, formatShortDate } from '@/lib/dates';
import { useProjection } from './projection-api';
import { ProjectionChart } from './ProjectionChart';

const PERIODS = [
  { days: 30, label: '30 dias' },
  { days: 90, label: '3 meses' },
  { days: 180, label: '6 meses' },
  { days: 365, label: '1 ano' },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ProjectionPage() {
  const [params, setParams] = useSearchParams();
  const days = PERIODS.find((p) => String(p.days) === params.get('dias'))?.days ?? 90;
  const accountParam = params.get('conta');
  const { data: accounts = [], isPending: accountsPending } = useAccounts();
  const cash = accounts.filter((a) => a.type !== 'CREDIT_CARD');
  const accountId =
    accountParam && UUID.test(accountParam) && cash.some((a) => a.id === accountParam)
      ? accountParam
      : undefined;
  const { data, isPending, isFetching, error } = useProjection(days, accountId);

  const set = (key: string, value?: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader
        title="Projeção"
        description="Quanto vai ter em cada dia, somando o saldo de hoje, os lançamentos previstos, as recorrências e as faturas dos cartões."
      />

      {!accountsPending && cash.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <p className="font-display text-xl font-semibold">Sem contas para projetar</p>
          <p className="mt-2 max-w-[46ch] text-[15px] text-slate">
            A projeção parte do saldo das contas correntes e carteiras.
          </p>
          <Link to="/contas" className="link-ember mt-4 text-sm">
            Cadastrar conta
          </Link>
        </div>
      ) : (
        <>
          {/* Filtros numa linha só, acima do gráfico */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Período"
              className="flex gap-1 rounded-[10px] bg-sunken p-1"
            >
              {PERIODS.map((period) => (
                <button
                  key={period.days}
                  type="button"
                  aria-pressed={days === period.days}
                  onClick={() => set('dias', period.days === 90 ? undefined : String(period.days))}
                  className={`h-9 rounded-[8px] px-3 text-sm font-medium transition-colors ${
                    days === period.days
                      ? 'bg-surface text-graphite shadow-sm'
                      : 'text-slate hover:text-graphite'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
            <Select
              aria-label="Conta"
              value={accountId ?? ''}
              onChange={(event) => set('conta', event.target.value)}
              className="!h-11 !w-auto min-w-[200px] text-sm"
            >
              <option value="">Todas as contas</option>
              {cash.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            {isFetching ? (
              <span className="size-2 animate-pulse rounded-full bg-ember" aria-hidden="true" />
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-[12px] bg-negative-soft px-4 py-3 text-sm text-negative"
            >
              {error.message}
            </p>
          ) : isPending || !data ? (
            <div className="card h-[420px] animate-pulse bg-sunken/40" aria-hidden="true" />
          ) : (
            <ProjectionView projection={data} />
          )}
        </>
      )}
    </>
  );
}

function ProjectionView({ projection }: { projection: ProjectionDto }) {
  const delta = projection.endBalanceCents - projection.startBalanceCents;
  const negative = projection.firstNegativeDate;

  return (
    <>
      <section aria-label="Resumo da projeção" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Landmark} label="Saldo hoje" value={projection.startBalanceCents} />
        <StatTile
          icon={delta >= 0 ? TrendingUp : TrendingDown}
          label={`Saldo em ${formatShortDate(projection.to)}`}
          value={projection.endBalanceCents}
          note={`${delta >= 0 ? '+' : '−'}${formatBRL(Math.abs(delta))} no período`}
        />
        <StatTile
          icon={TrendingDown}
          label="Menor saldo"
          value={projection.lowest.balanceCents}
          note={`Em ${formatShortDate(projection.lowest.date)}`}
        />
        {/* Status sempre com ícone e texto, nunca só cor */}
        <div
          className={`rounded-[16px] border p-5 ${
            negative ? 'border-negative/25 bg-negative-soft' : 'border-positive/20 bg-positive-soft'
          }`}
        >
          <div className="flex items-center gap-2">
            {negative ? (
              <CircleAlert size={18} className="text-negative" aria-hidden="true" />
            ) : (
              <CircleCheck size={18} className="text-positive" aria-hidden="true" />
            )}
            <span className={`text-sm font-medium ${negative ? 'text-negative' : 'text-positive'}`}>
              {negative ? 'Atenção' : 'Tudo no azul'}
            </span>
          </div>
          <p className="mt-2 font-display text-lg leading-snug font-semibold">
            {negative
              ? `Fica negativo em ${formatShortDate(negative)}`
              : 'O saldo não fica negativo no período'}
          </p>
          <p className="mt-1 text-[13px] text-steel">
            {negative
              ? 'Antecipe uma entrada, adie uma saída ou transfira da reserva antes dessa data.'
              : 'Considerando o que está previsto hoje.'}
          </p>
        </div>
      </section>

      <section aria-labelledby="titulo-curva" className="card mt-4 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-curva" className="text-lg font-semibold">
            Saldo previsto dia a dia
          </h2>
          <p className="text-[13px] text-slate">
            Passe o mouse sobre a curva para ver cada dia. O ponto marca o menor saldo.
          </p>
        </div>
        <ProjectionChart projection={projection} height={340} />
      </section>

      <EventsList projection={projection} />
    </>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate">{label}</span>
        <span className="grid size-9 place-items-center rounded-[10px] bg-sunken text-steel">
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p
        className={`tabular mt-2 font-display text-[26px] leading-none font-semibold tracking-[-0.02em] ${
          value < 0 ? 'text-negative' : ''
        }`}
      >
        {formatBRL(value)}
      </p>
      {note ? <p className="tabular mt-2 text-[13px] text-faint">{note}</p> : null}
    </div>
  );
}

/** Tabela dos movimentos: a mesma informação do gráfico, em texto. */
function EventsList({ projection }: { projection: ProjectionDto }) {
  const [limit, setLimit] = useState(40);
  const balanceByDate = useMemo(
    () => new Map(projection.points.map((point) => [point.date, point.balanceCents])),
    [projection.points],
  );
  const groups = useMemo(() => {
    const map = new Map<string, ProjectionEventDto[]>();
    for (const event of projection.events.slice(0, limit)) {
      map.set(event.date, [...(map.get(event.date) ?? []), event]);
    }
    return [...map.entries()];
  }, [projection.events, limit]);

  return (
    <section aria-labelledby="titulo-movimentos" className="card mt-4 overflow-hidden">
      <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 id="titulo-movimentos" className="font-semibold">
          Próximos movimentos
        </h2>
        <span className="tabular rounded-full bg-sunken px-2 py-0.5 text-[12px] text-slate">
          {projection.events.length}
        </span>
      </header>
      {groups.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate">
          Nada previsto no período. Cadastre recorrências e lançamentos futuros para a curva ganhar
          forma.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {groups.map(([date, events]) => {
            const balance = balanceByDate.get(date) ?? 0;
            return (
              <div key={date}>
                <div className="flex items-center justify-between bg-canvas/60 px-5 py-2 text-[13px]">
                  <span className="font-medium text-steel first-letter:uppercase">
                    {formatDayHeading(date)}
                  </span>
                  <span
                    className={`tabular ${balance < 0 ? 'font-medium text-negative' : 'text-slate'}`}
                  >
                    Saldo {formatBRL(balance)}
                  </span>
                </div>
                <ul>
                  {events.map((event, index) => (
                    <li key={`${date}-${index}`} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {event.kind === 'invoice' ? (
                            <CreditCard
                              size={14}
                              className="shrink-0 text-slate"
                              aria-hidden="true"
                            />
                          ) : null}
                          <span className="truncate">{event.description}</span>
                          {event.overdue ? (
                            <span className="shrink-0 rounded-full bg-negative-soft px-1.5 py-px text-[11px] font-medium text-negative">
                              Atrasado
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[12px] text-slate">
                          {event.accountName}
                        </span>
                      </span>
                      <span
                        className={`tabular text-sm font-semibold ${event.amountCents > 0 ? 'text-positive' : ''}`}
                      >
                        {event.amountCents > 0 ? '+' : '−'}
                        {formatBRL(Math.abs(event.amountCents))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {projection.events.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit((value) => value + 60)}
          className="w-full border-t border-line px-5 py-3 text-sm text-ember-deep hover:bg-sunken"
        >
          Mostrar mais
        </button>
      ) : null}
    </section>
  );
}
