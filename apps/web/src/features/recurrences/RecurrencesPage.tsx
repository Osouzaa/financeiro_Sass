import { addDays, formatBRL, todayIso, type RecurrenceDto } from '@financeiro/shared';
import { useMutation } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, CalendarRange, Plus, type LucideIcon } from 'lucide-react';
import { createElement, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/form';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { useAccounts } from '@/features/accounts/account-meta';
import { categoryIcon } from '@/features/categories/category-icons';
import { useInvalidateMoney } from '@/features/transactions/transaction-api';
import { PageHeader } from '@/layout/AppLayout';
import { api } from '@/lib/api';
import { describeFrequency, formatShortDate } from '@/lib/dates';
import { useRecurrences } from './recurrence-api';
import { RecurrenceFormModal } from './RecurrenceFormModal';

type Editing =
  | { mode: 'create'; preset?: { type: 'INCOME' | 'EXPENSE'; description: string } }
  | { mode: 'edit'; recurrence: RecurrenceDto }
  | null;

/** Atalhos do estado vazio: o que quase todo mundo tem. */
const SUGGESTIONS = [
  { type: 'INCOME', description: 'Salário' },
  { type: 'EXPENSE', description: 'Aluguel' },
  { type: 'EXPENSE', description: 'Internet' },
  { type: 'EXPENSE', description: 'Plano de saúde' },
  { type: 'EXPENSE', description: 'Streaming' },
] as const;

export function RecurrencesPage() {
  const { data: recurrences = [], isPending } = useRecurrences();
  const { data: accounts = [], isPending: accountsPending } = useAccounts();
  const [editing, setEditing] = useState<Editing>(null);
  const [ending, setEnding] = useState<RecurrenceDto | null>(null);

  const active = recurrences.filter((r) => r.active);
  const ended = recurrences.filter((r) => !r.active);
  const income = active.filter((r) => r.type === 'INCOME');
  const expense = active.filter((r) => r.type === 'EXPENSE');
  const monthlyIn = income.reduce((sum, r) => sum + r.monthlyCents, 0);
  const monthlyOut = expense.reduce((sum, r) => sum + r.monthlyCents, 0);
  const noAccounts = !accountsPending && accounts.length === 0;

  return (
    <>
      <PageHeader
        title="Recorrências"
        description="O que entra e sai todo mês com data certa. Cada recorrência gera os lançamentos previstos dos próximos 12 meses."
        actions={
          noAccounts ? undefined : (
            <Button type="button" onClick={() => setEditing({ mode: 'create' })}>
              <Plus size={18} aria-hidden="true" /> Nova recorrência
            </Button>
          )
        }
      />

      {noAccounts ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <p className="font-display text-xl font-semibold">Primeiro, uma conta</p>
          <p className="mt-2 max-w-[46ch] text-[15px] text-slate">
            Recorrências entram ou saem de alguma conta. Cadastre a sua e volte aqui.
          </p>
          <Link to="/contas" className="link-ember mt-4 text-sm">
            Cadastrar conta
          </Link>
        </div>
      ) : (
        <>
          <section aria-label="Compromissos fixos" className="grid gap-4 sm:grid-cols-3">
            <FixedTile
              icon={ArrowDownLeft}
              label="Entradas fixas por mês"
              value={monthlyIn}
              tone="positive"
              count={income.length}
            />
            <FixedTile
              icon={ArrowUpRight}
              label="Saídas fixas por mês"
              value={monthlyOut}
              tone="negative"
              count={expense.length}
            />
            <div className="dot-grid rounded-[16px] bg-night p-5 text-white">
              <p className="text-sm text-white/60">Sobra fixa</p>
              <p
                className={`tabular mt-2 font-display text-[28px] leading-none font-semibold tracking-[-0.02em] ${
                  monthlyIn - monthlyOut < 0 ? 'text-[#ff8a7f]' : ''
                }`}
              >
                {formatBRL(monthlyIn - monthlyOut)}
              </p>
              <p className="mt-2 text-[13px] text-white/55">
                {monthlyIn > 0
                  ? `As saídas fixas levam ${Math.round((monthlyOut / monthlyIn) * 100)}% das entradas`
                  : 'Antes dos gastos do dia a dia'}
              </p>
            </div>
          </section>

          {isPending ? (
            <div className="card mt-6 h-[240px] animate-pulse bg-sunken/40" aria-hidden="true" />
          ) : recurrences.length === 0 ? (
            <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember-deep">
                <CalendarRange size={26} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <p className="mt-5 font-display text-xl font-semibold">Comece pelo que é certo</p>
              <p className="mt-2 max-w-[48ch] text-[15px] text-slate">
                Cadastre o salário e as contas fixas uma vez. Elas aparecem nos próximos meses como
                previstas e alimentam a projeção de saldo.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.description}
                    type="button"
                    onClick={() => setEditing({ mode: 'create', preset: suggestion })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3.5 py-1.5 text-sm text-steel transition-colors hover:border-ember hover:text-ember-deep"
                  >
                    <Plus size={14} aria-hidden="true" />
                    {suggestion.description}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
                <RecurrenceList
                  title="Saídas"
                  items={expense}
                  empty="Nenhuma saída fixa. Aluguel, internet e assinaturas entram aqui."
                  onEdit={(recurrence) => setEditing({ mode: 'edit', recurrence })}
                />
                <RecurrenceList
                  title="Entradas"
                  items={income}
                  empty="Nenhuma entrada fixa. Comece pelo salário."
                  onEdit={(recurrence) => setEditing({ mode: 'edit', recurrence })}
                />
              </div>
              {ended.length ? (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-slate hover:text-graphite">
                    Encerradas ({ended.length})
                  </summary>
                  <div className="mt-3 opacity-70">
                    <RecurrenceList
                      title="Encerradas"
                      items={ended}
                      empty=""
                      onEdit={(recurrence) => setEditing({ mode: 'edit', recurrence })}
                    />
                  </div>
                </details>
              ) : null}
            </>
          )}
        </>
      )}

      {editing ? (
        <RecurrenceFormModal
          recurrence={editing.mode === 'edit' ? editing.recurrence : undefined}
          preset={editing.mode === 'create' ? editing.preset : undefined}
          onClose={() => setEditing(null)}
          onEnd={(recurrence) => {
            setEditing(null);
            setEnding(recurrence);
          }}
        />
      ) : null}
      {ending ? <EndModal recurrence={ending} onClose={() => setEnding(null)} /> : null}
    </>
  );
}

function FixedTile({
  icon: Icon,
  label,
  value,
  tone,
  count,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: 'positive' | 'negative';
  count: number;
}) {
  const chip =
    tone === 'positive' ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative';
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate">{label}</span>
        <span className={`grid size-9 place-items-center rounded-[10px] ${chip}`}>
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p className="tabular mt-2 font-display text-[28px] leading-none font-semibold tracking-[-0.02em]">
        {formatBRL(value)}
      </p>
      <p className="mt-2 text-[13px] text-faint">
        {count === 0
          ? 'Nenhuma cadastrada'
          : `${count} ${count === 1 ? 'recorrência' : 'recorrências'}`}
      </p>
    </div>
  );
}

function RecurrenceList({
  title,
  items,
  empty,
  onEdit,
}: {
  title: string;
  items: RecurrenceDto[];
  empty: string;
  onEdit: (recurrence: RecurrenceDto) => void;
}) {
  const soonLimit = addDays(todayIso(), 7);
  return (
    <section aria-label={title} className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-semibold">{title}</h2>
        <span className="tabular rounded-full bg-sunken px-2 py-0.5 text-[12px] text-slate">
          {items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((recurrence) => {
            const color = recurrence.category?.color ?? '#7a7a80';
            const soon = recurrence.nextDate !== null && recurrence.nextDate <= soonLimit;
            return (
              <li key={recurrence.id}>
                <button
                  type="button"
                  onClick={() => onEdit(recurrence)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-canvas/70"
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-[12px]"
                    style={{ background: `${color}14`, color }}
                  >
                    {createElement(categoryIcon(recurrence.category?.icon ?? null), {
                      size: 18,
                      strokeWidth: 1.75,
                      'aria-hidden': true,
                    })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{recurrence.description}</span>
                    <span className="block truncate text-[13px] text-slate">
                      {describeFrequency(recurrence.frequency, recurrence.startDate)} ·{' '}
                      {recurrence.account.name}
                      {recurrence.endDate ? ` · até ${formatShortDate(recurrence.endDate)}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`tabular block font-display text-[15px] font-semibold ${
                        recurrence.type === 'INCOME' ? 'text-positive' : ''
                      }`}
                    >
                      {recurrence.type === 'INCOME' ? '+' : '−'}
                      {formatBRL(recurrence.amountCents)}
                    </span>
                    <span
                      className={`tabular block text-[12px] ${soon ? 'font-medium text-ember-deep' : 'text-faint'}`}
                    >
                      {recurrence.nextDate
                        ? `próxima ${formatShortDate(recurrence.nextDate)}`
                        : 'encerrada'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EndModal({ recurrence, onClose }: { recurrence: RecurrenceDto; onClose: () => void }) {
  const invalidate = useInvalidateMoney();
  const notify = useToast();
  const end = useMutation({
    mutationFn: () => api(`/recurrences/${recurrence.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void invalidate();
      notify(`${recurrence.description} encerrada`);
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Encerrar “${recurrence.description}”?`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="!bg-negative hover:!bg-[#a92e26]"
            loading={end.isPending}
            onClick={() => end.mutate()}
          >
            Encerrar
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-steel">
        Os lançamentos previstos de hoje em diante são removidos e somem da projeção. O que já
        aconteceu continua no histórico, como lançamento comum.
      </p>
      {end.error ? (
        <p
          role="alert"
          className="mt-4 rounded-[10px] bg-negative-soft px-4 py-3 text-sm text-negative"
        >
          {end.error.message}
        </p>
      ) : null}
    </Modal>
  );
}
