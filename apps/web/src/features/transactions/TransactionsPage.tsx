import {
  addMonths,
  formatBRL,
  formatYearMonth,
  monthBounds,
  parseYearMonth,
  todayIso,
  type TransactionDto,
  type TransactionFilter,
  type TransactionListDto,
} from '@financeiro/shared';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  CircleDashed,
  Clock3,
  CreditCard,
  Plus,
  ReceiptText,
  Repeat,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { createElement, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/form';
import { Select } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { useAccounts } from '@/features/accounts/account-meta';
import { categoryIcon } from '@/features/categories/category-icons';
import { useCategories } from '@/features/categories/use-categories';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { PageHeader } from '@/layout/AppLayout';
import { api } from '@/lib/api';
import { formatDayHeading, formatMonthShort, formatMonthTitle } from '@/lib/dates';
import { ScopePicker, type Scope } from './RepeatOptions';
import { useInvalidateMoney, useToggleStatus, useTransactions } from './transaction-api';
import { TransactionFormModal, type FormMode, type FormTarget } from './TransactionFormModal';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const TYPE_FILTERS = [
  { value: '', label: 'Tudo' },
  { value: 'EXPENSE', label: 'Despesas' },
  { value: 'INCOME', label: 'Receitas' },
  { value: 'TRANSFER', label: 'Transferências' },
] as const;

const NEW_PARAM: Record<string, FormMode> = {
  despesa: 'EXPENSE',
  receita: 'INCOME',
  transferencia: 'TRANSFER',
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Valor com sinal do ponto de vista da lista: transferências só contam quando há conta filtrada. */
function signedAmount(item: TransactionDto, byAccount: boolean): number {
  if (item.type === 'INCOME') return item.amountCents;
  if (item.type === 'EXPENSE') return -item.amountCents;
  if (!byAccount) return 0;
  return item.transfer?.direction === 'IN' ? item.amountCents : -item.amountCents;
}

export function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const currentMonth = todayIso().slice(0, 7);

  // Filtros vivem na URL: dá para voltar, recarregar e compartilhar o link
  const pick = (key: string, valid: (value: string) => boolean) => {
    const value = params.get(key);
    return value && valid(value) ? value : undefined;
  };
  const month = pick('mes', (v) => MONTH.test(v)) ?? currentMonth;
  const accountId = pick('conta', (v) => UUID.test(v));
  const categoryId = pick('categoria', (v) => UUID.test(v));
  const type = pick('tipo', (v) => ['INCOME', 'EXPENSE', 'TRANSFER'].includes(v)) as
    TransactionFilter['type'] | undefined;
  const status = pick('status', (v) => v === 'PAID' || v === 'PLANNED') as
    TransactionFilter['status'] | undefined;

  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim()).slice(0, 100);

  const setParam = (key: string, value?: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const filter: TransactionFilter = {
    ...monthBounds(month),
    accountId,
    categoryId,
    type,
    status,
    q: q || undefined,
  };
  const { data, isPending, isFetching, error } = useTransactions(filter);
  const { data: accounts = [], isPending: accountsPending } = useAccounts();
  const { data: categories = [] } = useCategories();

  // ?novo=despesa abre o formulário direto (atalho do painel)
  const [form, setForm] = useState<FormTarget | null>(() => {
    const mode = NEW_PARAM[params.get('novo') ?? ''];
    return mode ? { mode: 'create', type: mode, accountId } : null;
  });
  const [deleting, setDeleting] = useState<TransactionDto | null>(null);
  useEffect(() => {
    if (params.has('novo')) setParam('novo');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = (mode: FormMode) => setForm({ mode: 'create', type: mode, accountId });
  const hasFilters = Boolean(accountId || categoryId || type || status || q);
  const items = useMemo(() => data?.items ?? [], [data]);

  const groups = useMemo(() => {
    const map = new Map<string, TransactionDto[]>();
    for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return [...map.entries()];
  }, [items]);

  const shiftMonth = (amount: number) => {
    const { year, month: m } = parseYearMonth(month);
    const next = addMonths(year, m, amount);
    setParam('mes', formatYearMonth(next.year, next.month));
  };

  const noAccounts = !accountsPending && accounts.length === 0;

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description="Receitas, despesas e transferências. Compras no cartão entram na fatura automaticamente."
        actions={
          noAccounts ? undefined : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => openNew('TRANSFER')}
                className="hidden sm:inline-flex"
              >
                <ArrowLeftRight size={17} aria-hidden="true" /> Transferir
              </Button>
              <Button type="button" onClick={() => openNew('EXPENSE')}>
                <Plus size={18} aria-hidden="true" /> Novo lançamento
              </Button>
            </>
          )
        }
      />

      {noAccounts ? (
        <NoAccounts />
      ) : (
        <>
          <MonthSwitcher
            month={month}
            isCurrent={month === currentMonth}
            onShift={shiftMonth}
            onToday={() => setParam('mes')}
            loading={isFetching}
          />

          <SummaryStrip summary={data?.summary} />

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-label="Lista de lançamentos" className="min-w-0">
              <div className="card p-3 sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <label className="relative flex-1">
                    <span className="sr-only">Buscar pela descrição</span>
                    <Search
                      size={18}
                      className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      maxLength={100}
                      placeholder="Buscar pela descrição"
                      className="h-11 w-full rounded-[10px] border border-line-strong bg-surface pr-4 pl-11 text-[15px] placeholder:text-faint hover:border-faint focus:border-ember focus:ring-4 focus:ring-ember-soft focus:outline-none"
                    />
                  </label>
                  <div
                    role="group"
                    aria-label="Tipo"
                    className="flex gap-1 overflow-x-auto rounded-[10px] bg-sunken p-1"
                  >
                    {TYPE_FILTERS.map((option) => {
                      const selected = (type ?? '') === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setParam('tipo', option.value)}
                          className={`h-9 shrink-0 rounded-[8px] px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                            selected
                              ? 'bg-surface text-graphite shadow-sm'
                              : 'text-slate hover:text-graphite'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select
                    aria-label="Conta"
                    value={accountId ?? ''}
                    onChange={(event) => setParam('conta', event.target.value)}
                    className="!h-10 text-sm"
                  >
                    <option value="">Todas as contas</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Categoria"
                    value={categoryId ?? ''}
                    onChange={(event) => setParam('categoria', event.target.value)}
                    className="!h-10 text-sm"
                  >
                    <option value="">Todas as categorias</option>
                    {(['EXPENSE', 'INCOME'] as const).map((group) => (
                      <optgroup key={group} label={group === 'EXPENSE' ? 'Despesas' : 'Receitas'}>
                        {categories
                          .filter((c) => c.type === group)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </Select>
                  <Select
                    aria-label="Status"
                    value={status ?? ''}
                    onChange={(event) => setParam('status', event.target.value)}
                    className="!h-10 text-sm"
                  >
                    <option value="">Realizados e previstos</option>
                    <option value="PAID">Só realizados</option>
                    <option value="PLANNED">Só previstos</option>
                  </Select>
                </div>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setParams(month === currentMonth ? {} : { mes: month }, { replace: true });
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate hover:text-graphite"
                  >
                    <X size={14} aria-hidden="true" /> Limpar filtros
                  </button>
                ) : null}
              </div>

              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-[12px] bg-negative-soft px-4 py-3 text-sm text-negative"
                >
                  {error.message}
                </p>
              ) : isPending ? (
                <ListSkeleton />
              ) : items.length === 0 ? (
                <EmptyList
                  month={month}
                  filtered={hasFilters}
                  onNew={openNew}
                  onClear={() => {
                    setSearch('');
                    setParams(month === currentMonth ? {} : { mes: month }, { replace: true });
                  }}
                />
              ) : (
                <div
                  className={`mt-4 space-y-4 transition-opacity ${isFetching ? 'opacity-70' : ''}`}
                >
                  {groups.map(([date, dayItems]) => (
                    <DayGroup
                      key={date}
                      date={date}
                      items={dayItems}
                      byAccount={Boolean(accountId)}
                      onEdit={(transaction) => setForm({ mode: 'edit', transaction })}
                    />
                  ))}
                  {data?.truncated ? (
                    <p className="text-center text-sm text-slate">
                      Mostrando os 1.000 lançamentos mais recentes do mês. Use os filtros para
                      encontrar os demais.
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            <aside className="grid gap-4 sm:grid-cols-2 xl:sticky xl:top-20 xl:grid-cols-1">
              <CategoryBreakdown
                summary={data?.summary}
                selected={categoryId}
                onSelect={(id) => setParam('categoria', id === categoryId ? undefined : id)}
              />
              <PendingCard
                items={items}
                active={status === 'PLANNED'}
                onToggle={() => setParam('status', status === 'PLANNED' ? undefined : 'PLANNED')}
              />
            </aside>
          </div>

          {/* Atalho no celular: o botão do topo fica longe do polegar */}
          <button
            type="button"
            onClick={() => openNew('EXPENSE')}
            className="fixed right-5 bottom-5 z-30 grid size-14 place-items-center rounded-full bg-ember text-white shadow-[0_12px_32px_-8px_rgb(229_83_26/0.6)] transition-transform active:scale-95 lg:hidden"
            aria-label="Novo lançamento"
          >
            <Plus size={26} />
          </button>
        </>
      )}

      {form ? (
        <TransactionFormModal
          target={form}
          onClose={() => setForm(null)}
          onDelete={(transaction) => {
            setForm(null);
            setDeleting(transaction);
          }}
        />
      ) : null}
      {deleting ? <DeleteModal transaction={deleting} onClose={() => setDeleting(null)} /> : null}
    </>
  );
}

function SummaryStrip({ summary }: { summary?: TransactionListDto['summary'] }) {
  const income = summary?.incomeCents ?? 0;
  const expense = summary?.expenseCents ?? 0;
  const net = summary?.netCents ?? 0;
  const spentShare = income > 0 ? Math.round((expense / income) * 100) : null;

  return (
    <section aria-label="Resumo do mês" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryTile
        icon={ArrowDownLeft}
        label="Receitas"
        value={income}
        planned={summary?.plannedIncomeCents ?? 0}
        tone="positive"
      />
      <SummaryTile
        icon={ArrowUpRight}
        label="Despesas"
        value={expense}
        planned={summary?.plannedExpenseCents ?? 0}
        tone="negative"
      />
      <div className="dot-grid relative overflow-hidden rounded-[16px] bg-night p-5 text-white sm:col-span-2 lg:col-span-1">
        <p className="text-sm text-white/60">Resultado do mês</p>
        <p
          className={`tabular mt-2 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] ${
            net < 0 ? 'text-[#ff8a7f]' : ''
          }`}
        >
          {net > 0 ? '+' : ''}
          {formatBRL(net)}
        </p>
        <div className="mt-4">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label="Parte das receitas já comprometida com despesas"
            aria-valuenow={Math.min(100, spentShare ?? 0)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full ${
                spentShare !== null && spentShare > 100 ? 'bg-[#ff8a7f]' : 'bg-ember'
              }`}
              style={{ width: `${Math.min(100, spentShare ?? 0)}%` }}
            />
          </div>
          <p className="mt-2 text-[13px] text-white/55">
            {spentShare === null
              ? expense > 0
                ? 'Despesas sem receitas no período'
                : 'Sem movimento no período'
              : `Despesas somam ${spentShare}% das receitas`}
          </p>
        </div>
      </div>
    </section>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  planned,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  planned: number;
  tone: 'positive' | 'negative';
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
      <p className="tabular mt-2 text-[13px] text-faint">
        {planned > 0 ? `${formatBRL(planned)} ainda previsto` : 'Tudo realizado'}
      </p>
    </div>
  );
}

function DayGroup({
  date,
  items,
  byAccount,
  onEdit,
}: {
  date: string;
  items: TransactionDto[];
  byAccount: boolean;
  onEdit: (transaction: TransactionDto) => void;
}) {
  const total = items.reduce((sum, item) => sum + signedAmount(item, byAccount), 0);
  const isToday = date === todayIso();
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-canvas/60 px-4 py-2.5 sm:px-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-steel first-letter:uppercase">
          {formatDayHeading(date)}
          {isToday ? (
            <span className="rounded-full bg-ember-soft px-2 py-0.5 text-[11px] font-semibold text-ember-deep">
              Hoje
            </span>
          ) : null}
        </h3>
        {total !== 0 ? (
          <span className={`tabular text-[13px] ${total > 0 ? 'text-positive' : 'text-slate'}`}>
            {total > 0 ? '+' : '−'}
            {formatBRL(Math.abs(total))}
          </span>
        ) : null}
      </header>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <TransactionRow
            key={item.id}
            item={item}
            byAccount={byAccount}
            onEdit={() => onEdit(item)}
          />
        ))}
      </ul>
    </section>
  );
}

function TransactionRow({
  item,
  byAccount,
  onEdit,
}: {
  item: TransactionDto;
  byAccount: boolean;
  onEdit: () => void;
}) {
  const toggle = useToggleStatus();
  const isTransfer = item.type === 'TRANSFER';
  const planned = item.status === 'PLANNED';
  const color = isTransfer ? '#4a4a4f' : (item.category?.color ?? '#7a7a80');

  const incoming = item.transfer?.direction === 'IN';
  const [from, to] = incoming
    ? [item.transfer?.counterpart?.name, item.account.name]
    : [item.account.name, item.transfer?.counterpart?.name];
  const subtitle = isTransfer
    ? `${from ?? '—'} → ${to ?? '—'}`
    : [item.category?.name, item.account.name].filter(Boolean).join(' · ');

  const signed = signedAmount(item, byAccount);
  const amountClass =
    isTransfer && !byAccount ? 'text-steel' : signed > 0 ? 'text-positive' : 'text-graphite';
  const sign = isTransfer && !byAccount ? '' : signed > 0 ? '+' : '−';
  // Compras no cartão são pagas pela fatura; o pagamento (transferência) tem status próprio
  const isCardEntry = Boolean(item.invoice) && !isTransfer;

  return (
    <li className="group flex items-center gap-2 px-2 transition-colors hover:bg-canvas/70 sm:gap-3 sm:px-3">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-3 text-left"
        aria-label={`Editar ${item.description}`}
      >
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-[12px] ${
            planned ? 'border border-dashed' : ''
          }`}
          style={{ background: `${color}14`, color, borderColor: planned ? color : undefined }}
        >
          {createElement(isTransfer ? ArrowLeftRight : categoryIcon(item.category?.icon ?? null), {
            size: 18,
            strokeWidth: 1.75,
            'aria-hidden': true,
          })}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.description}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-slate">
            <span className="truncate">{subtitle}</span>
            {item.installment ? (
              <span
                className="tabular inline-flex shrink-0 items-center rounded-full bg-ember-soft px-1.5 py-px text-[11px] font-medium text-ember-deep"
                title={`Parcela ${item.installment.number} de ${item.installment.total}`}
              >
                {item.installment.number}/{item.installment.total}
              </span>
            ) : null}
            {item.recurrenceId ? (
              <span title="Recorrente" className="inline-flex shrink-0 text-slate">
                <Repeat size={13} aria-label="Recorrente" />
              </span>
            ) : null}
            {item.invoice ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sunken px-1.5 py-px text-[11px] text-steel">
                <CreditCard size={11} aria-hidden="true" />
                Fatura {formatMonthShort(item.invoice.referenceMonth)}
              </span>
            ) : null}
          </span>
        </span>
      </button>

      {!isCardEntry ? (
        <button
          type="button"
          onClick={() => toggle.mutate({ id: item.id, status: planned ? 'PAID' : 'PLANNED' })}
          disabled={toggle.isPending}
          title={planned ? 'Marcar como realizado' : 'Voltar para previsto'}
          aria-label={`${item.description}: ${planned ? 'previsto, marcar como realizado' : 'realizado, voltar para previsto'}`}
          className={`hidden h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition-colors sm:inline-flex ${
            planned
              ? 'border border-dashed border-line-strong text-slate hover:border-positive hover:text-positive'
              : 'bg-positive-soft text-positive hover:bg-positive/15'
          }`}
        >
          {planned ? (
            <CircleDashed size={13} aria-hidden="true" />
          ) : (
            <Check size={13} aria-hidden="true" />
          )}
          {planned ? 'Previsto' : 'Realizado'}
        </button>
      ) : null}

      <span
        className={`tabular shrink-0 pr-2 text-right font-display text-[15px] font-semibold sm:min-w-[120px] ${amountClass} ${
          planned ? 'opacity-60' : ''
        }`}
      >
        {sign}
        {formatBRL(item.amountCents)}
      </span>
    </li>
  );
}

function CategoryBreakdown({
  summary,
  selected,
  onSelect,
}: {
  summary?: TransactionListDto['summary'];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const list = summary?.expensesByCategory ?? [];
  const total = summary?.expenseCents ?? 0;
  const max = list[0]?.totalCents ?? 0;

  return (
    <section aria-labelledby="titulo-para-onde" className="card p-5">
      <h2 id="titulo-para-onde" className="font-semibold">
        Para onde foi o dinheiro
      </h2>
      <p className="text-[13px] text-slate">Despesas do período por categoria</p>
      {list.length === 0 ? (
        <p className="mt-5 rounded-[12px] border border-dashed border-line-strong px-4 py-6 text-center text-sm text-slate">
          As despesas do mês aparecem aqui, agrupadas por categoria.
        </p>
      ) : (
        <ul className="mt-4 space-y-1">
          {list.slice(0, 7).map((category) => {
            const Icon = categoryIcon(category.icon);
            const color = category.color ?? '#7a7a80';
            const share = total > 0 ? Math.round((category.totalCents / total) * 100) : 0;
            const active = selected === category.categoryId;
            return (
              <li key={category.categoryId}>
                <button
                  type="button"
                  onClick={() => onSelect(category.categoryId)}
                  aria-pressed={active}
                  className={`w-full rounded-[10px] px-2 py-2 text-left transition-colors ${
                    active ? 'bg-ember-soft/70' : 'hover:bg-sunken'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Icon size={15} style={{ color }} aria-hidden="true" />
                    <span className="flex-1 truncate">{category.name}</span>
                    <span className="tabular text-slate">{formatBRL(category.totalCents)}</span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${max > 0 ? (category.totalCents / max) * 100 : 0}%`,
                          background: color,
                        }}
                      />
                    </span>
                    <span className="tabular w-9 text-right text-[12px] text-faint">{share}%</span>
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

function PendingCard({
  items,
  active,
  onToggle,
}: {
  items: TransactionDto[];
  active: boolean;
  onToggle: () => void;
}) {
  // Compras no cartão são pagas pela fatura, então não contam como pendência avulsa
  const pending = items.filter((item) => item.status === 'PLANNED' && !item.invoice);
  const toPay = pending
    .filter((item) => item.type === 'EXPENSE')
    .reduce((sum, item) => sum + item.amountCents, 0);
  const toReceive = pending
    .filter((item) => item.type === 'INCOME')
    .reduce((sum, item) => sum + item.amountCents, 0);

  return (
    <section aria-labelledby="titulo-pendentes" className="card p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-[10px] bg-ember-soft text-ember-deep">
          <Clock3 size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div>
          <h2 id="titulo-pendentes" className="font-semibold">
            Ainda previsto
          </h2>
          <p className="text-[13px] text-slate">
            {pending.length === 0
              ? 'Nada pendente no período'
              : `${pending.length} ${pending.length === 1 ? 'lançamento' : 'lançamentos'}`}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[10px] bg-canvas px-3 py-2.5">
          <dt className="text-[12px] text-slate">A pagar</dt>
          <dd className="tabular font-semibold">{formatBRL(toPay)}</dd>
        </div>
        <div className="rounded-[10px] bg-canvas px-3 py-2.5">
          <dt className="text-[12px] text-slate">A receber</dt>
          <dd className="tabular font-semibold text-positive">{formatBRL(toReceive)}</dd>
        </div>
      </dl>
      {pending.length > 0 || active ? (
        <button type="button" onClick={onToggle} className="link-ember mt-3 text-sm">
          {active ? 'Mostrar todos' : 'Ver só os previstos'}
        </button>
      ) : null}
    </section>
  );
}

function DeleteModal({
  transaction,
  onClose,
}: {
  transaction: TransactionDto;
  onClose: () => void;
}) {
  const invalidate = useInvalidateMoney();
  const notify = useToast();
  const hasSeries = Boolean(transaction.installment || transaction.recurrenceId);
  const [scope, setScope] = useState<Scope>('this');
  const remove = useMutation({
    mutationFn: () =>
      api(`/transactions/${transaction.id}${hasSeries ? `?scope=${scope}` : ''}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void invalidate();
      notify(
        scope === 'future'
          ? transaction.installment
            ? 'Parcelas excluídas'
            : 'Recorrência encerrada a partir desta data'
          : 'Lançamento excluído',
      );
      onClose();
    },
  });
  const isTransfer = transaction.type === 'TRANSFER';

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Excluir “${transaction.description}”?`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="!bg-negative hover:!bg-[#a92e26]"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Excluir
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-steel">
        {isTransfer
          ? 'A transferência sai das duas contas. Os saldos voltam a ser como antes dela.'
          : `O valor de ${formatBRL(transaction.amountCents)} deixa de contar no saldo e nos relatórios.`}{' '}
        A exclusão não pode ser desfeita.
      </p>
      {hasSeries ? (
        <div className="mt-4">
          <ScopePicker transaction={transaction} value={scope} onChange={setScope} />
        </div>
      ) : null}
      {remove.error ? (
        <p
          role="alert"
          className="mt-4 rounded-[10px] bg-negative-soft px-4 py-3 text-sm text-negative"
        >
          {remove.error.message}
        </p>
      ) : null}
    </Modal>
  );
}

function ListSkeleton() {
  return (
    <div className="card mt-4 divide-y divide-line" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-5 py-4">
          <span className="size-10 animate-pulse rounded-[12px] bg-sunken" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 animate-pulse rounded bg-sunken" />
            <span className="block h-3 w-1/4 animate-pulse rounded bg-sunken" />
          </span>
          <span className="h-4 w-20 animate-pulse rounded bg-sunken" />
        </div>
      ))}
    </div>
  );
}

function EmptyList({
  month,
  filtered,
  onNew,
  onClear,
}: {
  month: string;
  filtered: boolean;
  onNew: (mode: FormMode) => void;
  onClear: () => void;
}) {
  return (
    <div className="card mt-4 flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember-deep">
        <ReceiptText size={26} strokeWidth={1.75} aria-hidden="true" />
      </span>
      {filtered ? (
        <>
          <p className="mt-5 font-display text-xl font-semibold">Nada encontrado</p>
          <p className="mt-2 max-w-[44ch] text-[15px] text-slate">
            Nenhum lançamento combina com esses filtros em {formatMonthTitle(month)}.
          </p>
          <Button type="button" variant="secondary" className="mt-6" onClick={onClear}>
            Limpar filtros
          </Button>
        </>
      ) : (
        <>
          <p className="mt-5 font-display text-xl font-semibold">
            Nenhum lançamento em {formatMonthTitle(month)}
          </p>
          <p className="mt-2 max-w-[46ch] text-[15px] text-slate">
            Comece pelo que já entrou e saiu. Cada lançamento atualiza o saldo da conta e, no
            cartão, a fatura.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="secondary" onClick={() => onNew('INCOME')}>
              <ArrowDownLeft size={17} aria-hidden="true" /> Receita
            </Button>
            <Button type="button" onClick={() => onNew('EXPENSE')}>
              <ArrowUpRight size={17} aria-hidden="true" /> Despesa
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function NoAccounts() {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember-deep">
        <ReceiptText size={26} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-5 font-display text-xl font-semibold">Primeiro, uma conta</p>
      <p className="mt-2 max-w-[46ch] text-[15px] text-slate">
        Todo lançamento sai de algum lugar. Cadastre a conta onde você recebe ou o cartão que usa e
        volte aqui.
      </p>
      <Link
        to="/contas"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-[10px] bg-graphite px-4 text-sm font-medium text-white transition-colors hover:bg-black"
      >
        <Plus size={18} aria-hidden="true" /> Cadastrar conta
      </Link>
    </div>
  );
}
