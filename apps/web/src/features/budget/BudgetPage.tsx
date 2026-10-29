import {
  addMonths,
  formatBRL,
  formatYearMonth,
  parseYearMonth,
  todayIso,
  type BudgetItemDto,
  type BudgetMonthDto,
  type CategoryRefDto,
} from '@financeiro/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Copy, PiggyBank, Plus, TriangleAlert } from 'lucide-react';
import { createElement, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button, FormAlert } from '@/components/form';
import { CurrencyInput, Field, Select } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { useToast } from '@/components/toast';
import { categoryIcon } from '@/features/categories/category-icons';
import { useCategories } from '@/features/categories/use-categories';
import { PageHeader } from '@/layout/AppLayout';
import { api, ApiError } from '@/lib/api';
import { formatMonthTitle } from '@/lib/dates';
import { useBudgetMonth } from './budget-api';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

type Editing =
  | { mode: 'create'; category?: CategoryRefDto; suggestedCents?: number }
  | { mode: 'edit'; item: BudgetItemDto }
  | null;

type Status = 'ok' | 'warning' | 'over';

function statusOf(
  item: { usedCents: number; limitCents: number },
  alertPercent: number | null,
): Status {
  const percent = (item.usedCents / item.limitCents) * 100;
  if (percent > 100) return 'over';
  if (alertPercent !== null && percent >= alertPercent) return 'warning';
  return 'ok';
}

/** Status reservado: sempre com ícone e rótulo, nunca só cor. */
const STATUS: Record<
  Status,
  { label: string; icon: typeof CircleCheck; text: string; bar: string }
> = {
  ok: { label: 'No ritmo', icon: CircleCheck, text: 'text-positive', bar: 'bg-graphite' },
  warning: {
    label: 'Perto do limite',
    icon: TriangleAlert,
    text: 'text-brass',
    bar: 'bg-[#d69a1c]',
  },
  over: { label: 'Estourou', icon: CircleAlert, text: 'text-negative', bar: 'bg-negative' },
};

const shiftMonth = (month: string, amount: number) => {
  const { year, month: m } = parseYearMonth(month);
  const next = addMonths(year, m, amount);
  return formatYearMonth(next.year, next.month);
};

/** Sugestão de limite: o gasto arredondado para cima, em dezenas de reais. */
const roundUp = (cents: number) => Math.max(1000, Math.ceil(cents / 1000) * 1000);

export function BudgetPage() {
  const [params, setParams] = useSearchParams();
  const currentMonth = todayIso().slice(0, 7);
  const monthParam = params.get('mes');
  const month = monthParam && MONTH.test(monthParam) ? monthParam : currentMonth;
  const { data, isPending, isFetching, error } = useBudgetMonth(month);
  const [editing, setEditing] = useState<Editing>(null);
  const queryClient = useQueryClient();
  const notify = useToast();

  const copy = useMutation({
    mutationFn: () =>
      api<BudgetMonthDto>('/budgets/copy', {
        method: 'POST',
        body: { from: shiftMonth(month, -1), to: month },
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(['budgets', month], result);
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
      notify(
        result.items.length
          ? `Limites de ${formatMonthTitle(shiftMonth(month, -1)).split(' ')[0]} copiados`
          : 'O mês anterior não tinha limites',
      );
    },
    onError: (failure) => notify(failure.message, 'error'),
  });

  const goTo = (target: string) =>
    setParams(target === currentMonth ? {} : { mes: target }, { replace: true });

  return (
    <>
      <PageHeader
        title="Orçamento"
        description="Um limite por categoria a cada mês. Conta pela data da compra: o que foi gasto e o que ainda está previsto."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              loading={copy.isPending}
              onClick={() => copy.mutate()}
              className="hidden sm:inline-flex"
            >
              <Copy size={16} aria-hidden="true" /> Copiar do mês anterior
            </Button>
            <Button type="button" onClick={() => setEditing({ mode: 'create' })}>
              <Plus size={18} aria-hidden="true" /> Novo limite
            </Button>
          </>
        }
      />

      <MonthSwitcher
        month={month}
        isCurrent={month === currentMonth}
        onShift={(amount) => goTo(shiftMonth(month, amount))}
        onToday={() => goTo(currentMonth)}
        loading={isFetching}
      />

      {error ? (
        <p role="alert" className="rounded-[12px] bg-negative-soft px-4 py-3 text-sm text-negative">
          {error.message}
        </p>
      ) : isPending || !data ? (
        <div className="card h-[240px] animate-pulse bg-sunken/40" aria-hidden="true" />
      ) : (
        <>
          <BudgetHero budget={data} />

          {data.items.length === 0 ? (
            <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember-deep">
                <PiggyBank size={26} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <p className="mt-5 font-display text-xl font-semibold">
                Nenhum limite em {formatMonthTitle(month)}
              </p>
              <p className="mt-2 max-w-[48ch] text-[15px] text-slate">
                Comece pelas categorias que mais pesam. Os limites valem só para o mês; no próximo,
                é só copiar.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={copy.isPending}
                  onClick={() => copy.mutate()}
                >
                  <Copy size={16} aria-hidden="true" /> Copiar do mês anterior
                </Button>
                <Button type="button" onClick={() => setEditing({ mode: 'create' })}>
                  <Plus size={18} aria-hidden="true" /> Novo limite
                </Button>
              </div>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {data.items.map((item) => (
                <BudgetCard
                  key={item.id}
                  item={item}
                  alertPercent={data.alertPercent}
                  onEdit={() => setEditing({ mode: 'edit', item })}
                />
              ))}
            </ul>
          )}

          {data.unbudgeted.length ? (
            <section aria-labelledby="titulo-sem-limite" className="mt-8">
              <h2 id="titulo-sem-limite" className="text-lg font-semibold">
                Gastos sem limite
              </h2>
              <p className="text-sm text-slate">
                Categorias com despesas neste mês que ainda não têm orçamento.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {data.unbudgeted.map(({ category, usedCents }) => (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({ mode: 'create', category, suggestedCents: roundUp(usedCents) })
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-dashed border-line-strong bg-surface py-1.5 pr-3 pl-1.5 text-sm transition-colors hover:border-ember"
                    >
                      <span
                        className="grid size-6 place-items-center rounded-full"
                        style={{
                          background: `${category.color ?? '#7a7a80'}22`,
                          color: category.color ?? '#7a7a80',
                        }}
                      >
                        {createElement(categoryIcon(category.icon), {
                          size: 13,
                          'aria-hidden': true,
                        })}
                      </span>
                      {category.name}
                      <span className="tabular text-slate">{formatBRL(usedCents)}</span>
                      <Plus size={14} className="text-ember-deep" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {editing && data ? (
        <LimitModal
          month={month}
          editing={editing}
          budgeted={data.items.map((item) => item.category.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function BudgetHero({ budget }: { budget: BudgetMonthDto }) {
  const { limitCents, spentCents, usedCents } = budget.totals;
  const spentShare = limitCents > 0 ? Math.min(100, (spentCents / limitCents) * 100) : 0;
  const plannedShare =
    limitCents > 0 ? Math.min(100 - spentShare, ((usedCents - spentCents) / limitCents) * 100) : 0;
  const remaining = limitCents - usedCents;
  const counts = budget.items.reduce(
    (acc, item) => ({
      ...acc,
      [statusOf(item, budget.alertPercent)]: acc[statusOf(item, budget.alertPercent)] + 1,
    }),
    { ok: 0, warning: 0, over: 0 } as Record<Status, number>,
  );

  return (
    <section
      aria-label="Resumo do orçamento"
      className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
    >
      <div className="dot-grid rounded-[18px] bg-night p-6 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">Consumido do orçamento</p>
            <p className="tabular font-display text-[38px] leading-none font-semibold tracking-[-0.02em]">
              {formatBRL(usedCents)}
            </p>
            <p className="tabular mt-2 text-sm text-white/65">de {formatBRL(limitCents)} orçados</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/60">{remaining >= 0 ? 'Ainda cabe' : 'Passou'}</p>
            <p
              className={`tabular font-display text-2xl font-semibold ${remaining < 0 ? 'text-[#ff8a7f]' : ''}`}
            >
              {formatBRL(Math.abs(remaining))}
            </p>
          </div>
        </div>
        <div
          className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-white/12"
          role="progressbar"
          aria-label="Parte do orçamento consumida"
          aria-valuenow={Math.round(spentShare + plannedShare)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="h-full bg-ember" style={{ width: `${spentShare}%` }} />
          <span
            className="h-full bg-[repeating-linear-gradient(45deg,#ff682c99_0_4px,transparent_4px_8px)]"
            style={{ width: `${plannedShare}%` }}
          />
        </div>
        <p className="tabular mt-3 text-[13px] text-white/55">
          {formatBRL(spentCents)} gastos · {formatBRL(usedCents - spentCents)} ainda previstos
        </p>
      </div>
      <div className="card grid content-center gap-3 p-5">
        {(['over', 'warning', 'ok'] as const).map((status) => {
          const meta = STATUS[status];
          return (
            <div key={status} className="flex items-center gap-3">
              <meta.icon size={18} className={meta.text} aria-hidden="true" />
              <span className="flex-1 text-sm">{meta.label}</span>
              <span className="tabular font-display text-xl font-semibold">{counts[status]}</span>
            </div>
          );
        })}
        {budget.alertPercent !== null ? (
          <p className="border-t border-line pt-3 text-[12px] text-slate">
            Alerta a partir de {budget.alertPercent}% do limite (em Configurações → Alertas).
          </p>
        ) : null}
      </div>
    </section>
  );
}

function BudgetCard({
  item,
  alertPercent,
  onEdit,
}: {
  item: BudgetItemDto;
  alertPercent: number | null;
  onEdit: () => void;
}) {
  const status = STATUS[statusOf(item, alertPercent)];
  const color = item.category.color ?? '#7a7a80';
  const spentShare = Math.min(100, (item.spentCents / item.limitCents) * 100);
  const plannedShare = Math.min(100 - spentShare, (item.plannedCents / item.limitCents) * 100);
  const percent = Math.round((item.usedCents / item.limitCents) * 100);
  const remaining = item.limitCents - item.usedCents;

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className="card block w-full p-5 text-left transition-colors hover:border-line-strong"
        aria-label={`${item.category.name}: ${percent}% do limite, ${status.label}. Editar limite`}
      >
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-[12px]"
            style={{ background: `${color}14`, color }}
          >
            {createElement(categoryIcon(item.category.icon), {
              size: 18,
              strokeWidth: 1.75,
              'aria-hidden': true,
            })}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{item.category.name}</span>
            <span
              className={`inline-flex items-center gap-1 text-[13px] font-medium ${status.text}`}
            >
              <status.icon size={13} aria-hidden="true" />
              {status.label}
            </span>
          </span>
          <span className="tabular font-display text-2xl font-semibold">{percent}%</span>
        </div>

        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
          <span className={`h-full ${status.bar}`} style={{ width: `${spentShare}%` }} />
          <span
            className="h-full bg-[repeating-linear-gradient(45deg,#7a7a8066_0_4px,transparent_4px_8px)]"
            style={{ width: `${plannedShare}%` }}
          />
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-3 text-sm">
          <span className="tabular text-steel">
            {formatBRL(item.usedCents)}{' '}
            <span className="text-slate">de {formatBRL(item.limitCents)}</span>
          </span>
          <span className={`tabular ${remaining < 0 ? 'font-medium text-negative' : 'text-slate'}`}>
            {remaining >= 0 ? `Sobram ${formatBRL(remaining)}` : `${formatBRL(-remaining)} acima`}
          </span>
        </div>
        {item.plannedCents > 0 ? (
          <p className="tabular mt-1 text-[12px] text-faint">
            Inclui {formatBRL(item.plannedCents)} ainda previsto
          </p>
        ) : null}
      </button>
    </li>
  );
}

function LimitModal({
  month,
  editing,
  budgeted,
  onClose,
}: {
  month: string;
  editing: NonNullable<Editing>;
  budgeted: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const { data: categories = [] } = useCategories();
  const item = editing.mode === 'edit' ? editing.item : undefined;
  const preset = editing.mode === 'create' ? editing.category : undefined;
  const [categoryId, setCategoryId] = useState(item?.category.id ?? preset?.id ?? '');
  const [limitCents, setLimitCents] = useState(
    item?.limitCents ?? (editing.mode === 'create' ? (editing.suggestedCents ?? 0) : 0),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Só categorias principais de despesa ainda sem limite no mês
  const options = categories.filter(
    (category) =>
      category.type === 'EXPENSE' &&
      (category.id === categoryId || !budgeted.includes(category.id)),
  );

  const apply = (result: BudgetMonthDto) => {
    queryClient.setQueryData(['budgets', month], result);
    void queryClient.invalidateQueries({ queryKey: ['budgets'] });
  };

  const save = useMutation({
    mutationFn: () =>
      api<BudgetMonthDto>('/budgets', { method: 'PUT', body: { month, categoryId, limitCents } }),
    onSuccess: (result) => {
      apply(result);
      notify(item ? 'Limite atualizado' : 'Limite definido');
      onClose();
    },
    onError: (failure) => setFieldErrors(failure instanceof ApiError ? failure.fields : {}),
  });
  const remove = useMutation({
    mutationFn: () => api(`/budgets/${item!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
      notify('Limite removido');
      onClose();
    },
  });
  const failure = save.error ?? remove.error;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={item ? `Limite de ${item.category.name}` : 'Novo limite'}
      description={`Vale para ${formatMonthTitle(month)}.`}
      footer={
        <>
          {item ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto !text-negative hover:!bg-negative-soft"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remover
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FormAlert
          message={failure && Object.keys(fieldErrors).length === 0 ? failure.message : undefined}
        />
        {!item ? (
          <Field label="Categoria" error={fieldErrors.categoryId?.[0]}>
            <Select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              error={fieldErrors.categoryId?.[0]}
            >
              <option value="" disabled>
                Escolha
              </option>
              {options.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field
          label="Limite no mês"
          error={fieldErrors.limitCents?.[0]}
          hint="Subcategorias somam neste limite."
        >
          <CurrencyInput
            size="lg"
            value={limitCents}
            onChange={setLimitCents}
            error={fieldErrors.limitCents?.[0]}
            aria-label="Limite no mês"
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  );
}
