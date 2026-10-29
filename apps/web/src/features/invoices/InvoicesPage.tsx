import {
  formatBRL,
  invoiceStatusLabels,
  type AccountDto,
  type InvoiceDto,
  type TransactionDto,
} from '@financeiro/shared';
import {
  ArrowLeftRight,
  CalendarCheck2,
  CircleDashed,
  CreditCard,
  Plus,
  ReceiptText,
  Undo2,
} from 'lucide-react';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/form';
import { useAccounts } from '@/features/accounts/account-meta';
import { categoryIcon } from '@/features/categories/category-icons';
import { useCategories } from '@/features/categories/use-categories';
import { PageHeader } from '@/layout/AppLayout';
import { formatMonthShort, formatMonthTitle, formatShortDate } from '@/lib/dates';
import { useInvoice, useInvoices } from './invoice-api';
import { PayInvoiceModal } from './PayInvoiceModal';

const STATUS_TONE: Record<InvoiceDto['status'], string> = {
  OPEN: 'bg-white/15 text-white',
  CLOSED: 'bg-[#ffd8c7] text-ember-deep',
  PARTIALLY_PAID: 'bg-[#fff1c2] text-brass',
  PAID: 'bg-positive-soft text-positive',
};

const DOT_TONE: Record<InvoiceDto['status'], string> = {
  OPEN: 'bg-faint',
  CLOSED: 'bg-ember',
  PARTIALLY_PAID: 'bg-[#e0b13a]',
  PAID: 'bg-positive',
};

const statusLabel = (invoice: InvoiceDto) =>
  invoice.overdue ? 'Vencida' : invoiceStatusLabels[invoice.status];

/** Fatura mostrada ao abrir o cartão: a mais antiga com valor a pagar já fechada, senão a aberta. */
function defaultInvoice(invoices: InvoiceDto[]): InvoiceDto | undefined {
  const ascending = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    ascending.find((invoice) => invoice.status !== 'OPEN' && invoice.remainingCents > 0) ??
    ascending.find((invoice) => invoice.status === 'OPEN') ??
    ascending.at(-1)
  );
}

export function InvoicesPage() {
  const [params, setParams] = useSearchParams();
  const { data: accounts = [], isPending: accountsPending } = useAccounts();
  const cards = accounts.filter((a) => a.type === 'CREDIT_CARD');
  const cardId = cards.find((c) => c.id === params.get('cartao'))?.id ?? cards[0]?.id;
  const card = cards.find((c) => c.id === cardId);

  const { data: invoices = [], isPending: invoicesPending } = useInvoices(
    { accountId: cardId },
    Boolean(cardId),
  );
  const invoiceId =
    invoices.find((i) => i.id === params.get('fatura'))?.id ?? defaultInvoice(invoices)?.id;
  const { data: detail } = useInvoice(invoiceId);
  const summary = invoices.find((i) => i.id === invoiceId);
  const [paying, setPaying] = useState<InvoiceDto | null>(null);

  const select = (next: { cartao?: string; fatura?: string }) =>
    setParams(
      (previous) => {
        const search = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(next)) {
          if (value) search.set(key, value);
          else search.delete(key);
        }
        return search;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader
        title="Faturas"
        description="O que cada cartão vai cobrar, quando fecha, quando vence e quanto já foi pago."
      />

      {accountsPending ? null : cards.length === 0 ? (
        <NoCards />
      ) : (
        <>
          <CardPicker
            cards={cards}
            selected={cardId}
            onSelect={(id) => select({ cartao: id, fatura: undefined })}
          />

          {invoicesPending ? (
            <div className="card mt-6 h-[220px] animate-pulse bg-sunken/40" aria-hidden="true" />
          ) : invoices.length === 0 ? (
            <NoInvoices card={card!} />
          ) : (
            <>
              <Timeline
                invoices={invoices}
                selected={invoiceId}
                onSelect={(id) => select({ fatura: id })}
              />
              {summary ? (
                <div className="mt-5 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="min-w-0 space-y-5">
                    <InvoiceHero
                      invoice={summary}
                      color={card?.color ?? '#1d1d1f'}
                      onPay={() => setPaying(summary)}
                    />
                    <ItemsList items={detail?.id === summary.id ? detail.items : undefined} />
                  </div>
                  <aside className="grid gap-4 sm:grid-cols-2 xl:sticky xl:top-20 xl:grid-cols-1">
                    <Breakdown invoice={summary} />
                    <CategorySplit items={detail?.id === summary.id ? detail.items : []} />
                  </aside>
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      {paying ? <PayInvoiceModal invoice={paying} onClose={() => setPaying(null)} /> : null}
    </>
  );
}

function CardPicker({
  cards,
  selected,
  onSelect,
}: {
  cards: AccountDto[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Cartões" className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {cards.map((card) => {
        const active = card.id === selected;
        const color = card.color ?? '#1d1d1f';
        return (
          <button
            key={card.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(card.id)}
            className={`relative flex h-[88px] w-[200px] shrink-0 flex-col justify-between overflow-hidden rounded-[14px] p-3.5 text-left text-white transition-[transform,box-shadow] ${
              active
                ? 'shadow-[0_12px_28px_-12px_rgb(0_0_0/0.55)] ring-2 ring-ember ring-offset-2 ring-offset-canvas'
                : 'opacity-75 hover:opacity-100'
            }`}
            style={{ background: `linear-gradient(135deg, ${color} 0%, #141414 130%)` }}
          >
            <span className="flex items-center justify-between">
              <span className="truncate text-sm font-semibold">{card.name}</span>
              <span className="h-4 w-6 rounded-[3px] bg-gradient-to-br from-[#e9c98f] to-[#b38b4d]" />
            </span>
            <span>
              <span className="block text-[11px] text-white/60">Em aberto</span>
              <span className="tabular block font-display text-[15px] font-semibold">
                {formatBRL(card.balanceCents)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Timeline({
  invoices,
  selected,
  onSelect,
}: {
  invoices: InvoiceDto[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  // Mais antigas à esquerda, como uma linha do tempo
  const ordered = useMemo(
    () => [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [invoices],
  );
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selected]);

  return (
    <div
      ref={scroller}
      role="tablist"
      aria-label="Faturas do cartão"
      className="card mt-4 flex gap-1.5 overflow-x-auto p-2"
    >
      {ordered.map((invoice) => {
        const active = invoice.id === selected;
        const year = invoice.referenceMonth.slice(2, 4);
        return (
          <button
            key={invoice.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(invoice.id)}
            className={`flex min-w-[92px] shrink-0 flex-col items-start rounded-[10px] px-3 py-2 text-left transition-colors ${
              active ? 'bg-graphite text-white' : 'hover:bg-sunken'
            }`}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-medium capitalize">
              <span
                className={`size-1.5 rounded-full ${invoice.overdue ? 'bg-negative' : DOT_TONE[invoice.status]}`}
                aria-hidden="true"
              />
              {formatMonthShort(invoice.referenceMonth)}/{year}
            </span>
            <span className={`tabular text-[12px] ${active ? 'text-white/70' : 'text-slate'}`}>
              {formatBRL(invoice.totalCents)}
            </span>
            <span className="sr-only">{statusLabel(invoice)}</span>
          </button>
        );
      })}
    </div>
  );
}

function InvoiceHero({
  invoice,
  color,
  onPay,
}: {
  invoice: InvoiceDto;
  color: string;
  onPay: () => void;
}) {
  const paidShare =
    invoice.totalCents > 0 ? Math.min(100, (invoice.paidCents / invoice.totalCents) * 100) : 100;
  const scheduledShare =
    invoice.totalCents > 0
      ? Math.min(100 - paidShare, (invoice.scheduledCents / invoice.totalCents) * 100)
      : 0;
  const canPay = invoice.remainingCents - invoice.scheduledCents > 0;
  const month = formatMonthTitle(invoice.referenceMonth).split(' ')[0];

  return (
    <section
      aria-label={`Fatura de ${month}`}
      className="dot-grid relative overflow-hidden rounded-[18px] p-6 text-white sm:p-7"
      style={{ background: `linear-gradient(135deg, ${color} -20%, #141414 85%)` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white/60">{invoice.account.name}</p>
          <h2 className="font-display text-2xl font-semibold first-letter:uppercase">
            Fatura de {month}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            invoice.overdue ? 'bg-negative text-white' : STATUS_TONE[invoice.status]
          }`}
        >
          {statusLabel(invoice)}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[13px] text-white/60">
            {invoice.status === 'OPEN' ? 'Total até agora' : 'Total da fatura'}
          </p>
          <p className="tabular font-display text-[40px] leading-none font-semibold tracking-[-0.02em] sm:text-[46px]">
            {formatBRL(invoice.totalCents)}
          </p>
          {invoice.remainingCents > 0 && invoice.remainingCents !== invoice.totalCents ? (
            <p className="tabular mt-2 text-sm text-white/75">
              Falta pagar {formatBRL(invoice.remainingCents)}
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <dt className="text-white/55">Fecha</dt>
          <dt className="text-white/55">Vence</dt>
          <dd className="tabular font-semibold">{formatShortDate(invoice.closingDate)}</dd>
          <dd className={`tabular font-semibold ${invoice.overdue ? 'text-[#ff8a7f]' : ''}`}>
            {formatShortDate(invoice.dueDate)}
          </dd>
        </dl>
      </div>

      <div className="mt-6">
        <div
          className="flex h-2 overflow-hidden rounded-full bg-white/12"
          role="progressbar"
          aria-label="Quanto da fatura já foi pago"
          aria-valuenow={Math.round(paidShare)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="h-full bg-[#5fd49b]" style={{ width: `${paidShare}%` }} />
          <span
            className="h-full bg-[repeating-linear-gradient(45deg,#5fd49b80_0_4px,transparent_4px_8px)]"
            style={{ width: `${scheduledShare}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-[13px] text-white/65">
            Pago {formatBRL(invoice.paidCents)}
            {invoice.scheduledCents > 0 ? ` · agendado ${formatBRL(invoice.scheduledCents)}` : ''}
          </p>
          {canPay ? (
            <Button
              type="button"
              onClick={onPay}
              className="!bg-white !text-graphite hover:!bg-ivory"
            >
              {invoice.status === 'OPEN' ? 'Antecipar pagamento' : 'Pagar fatura'}
            </Button>
          ) : invoice.status === 'PAID' ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-[#5fd49b]">
              <CalendarCheck2 size={16} aria-hidden="true" /> Quitada
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ItemsList({ items }: { items?: TransactionDto[] }) {
  if (!items) {
    return <div className="card h-[200px] animate-pulse bg-sunken/40" aria-hidden="true" />;
  }
  const purchases = items.filter((item) => item.type !== 'TRANSFER');
  const payments = items.filter((item) => item.type === 'TRANSFER');

  return (
    <>
      <section aria-labelledby="titulo-compras" className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 id="titulo-compras" className="font-semibold">
            Compras e estornos
          </h3>
          <span className="tabular rounded-full bg-sunken px-2 py-0.5 text-[12px] text-slate">
            {purchases.length}
          </span>
        </header>
        {purchases.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate">Nenhuma compra nesta fatura.</p>
        ) : (
          <ul className="divide-y divide-line">
            {purchases.map((item) => {
              const refund = item.type === 'INCOME';
              const color = item.category?.color ?? '#7a7a80';
              return (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-[10px]"
                    style={{ background: `${color}14`, color }}
                  >
                    {createElement(refund ? Undo2 : categoryIcon(item.category?.icon ?? null), {
                      size: 17,
                      strokeWidth: 1.75,
                      'aria-hidden': true,
                    })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.description}</span>
                    <span className="block truncate text-[12px] text-slate">
                      {formatShortDate(item.date)}
                      {item.category ? ` · ${item.category.name}` : ''}
                      {refund ? ' · Estorno' : ''}
                    </span>
                  </span>
                  <span
                    className={`tabular text-sm font-semibold ${refund ? 'text-positive' : ''}`}
                  >
                    {refund ? '−' : ''}
                    {formatBRL(item.amountCents)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-pagamentos" className="card overflow-hidden">
        <header className="border-b border-line px-5 py-3.5">
          <h3 id="titulo-pagamentos" className="font-semibold">
            Pagamentos
          </h3>
        </header>
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate">Nenhum pagamento ainda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map((item) => {
              const planned = item.status === 'PLANNED';
              return (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-positive-soft text-positive">
                    {planned ? (
                      <CircleDashed size={17} aria-hidden="true" />
                    ) : (
                      <ArrowLeftRight size={17} aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {planned ? 'Agendado' : 'Pago'} em {formatShortDate(item.date)}
                    </span>
                    <span className="block truncate text-[12px] text-slate">
                      De {item.transfer?.counterpart?.name ?? 'conta removida'}
                    </span>
                  </span>
                  <span
                    className={`tabular text-sm font-semibold text-positive ${planned ? 'opacity-60' : ''}`}
                  >
                    {formatBRL(item.amountCents)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-line px-5 py-3 text-[12px] text-faint">
          Pagamentos são transferências: para corrigir ou excluir, use a tela de Lançamentos.
        </p>
      </section>
    </>
  );
}

function Breakdown({ invoice }: { invoice: InvoiceDto }) {
  const rows: [string, number, string?][] = [
    ['Compras', invoice.purchasesCents],
    ['Estornos', -invoice.refundsCents, 'text-positive'],
    ['Total', invoice.totalCents, 'font-semibold'],
    ['Pago', -invoice.paidCents, 'text-positive'],
    ...(invoice.scheduledCents > 0
      ? ([['Agendado', -invoice.scheduledCents, 'text-slate']] as [string, number, string][])
      : []),
  ];
  return (
    <section aria-labelledby="titulo-resumo-fatura" className="card p-5">
      <h3 id="titulo-resumo-fatura" className="font-semibold">
        Resumo
      </h3>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-slate">{label}</dt>
            <dd className={`tabular ${tone ?? ''}`}>
              {value < 0 ? '−' : ''}
              {formatBRL(Math.abs(value))}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-baseline justify-between rounded-[12px] bg-canvas px-4 py-3">
        <span className="text-sm text-steel">Falta pagar</span>
        <span className="tabular font-display text-xl font-semibold">
          {formatBRL(invoice.remainingCents)}
        </span>
      </div>
    </section>
  );
}

function CategorySplit({ items }: { items: TransactionDto[] }) {
  const { data: categories = [] } = useCategories(true);
  const totals = useMemo(() => {
    const roots = new Map(categories.map((category) => [category.id, category]));
    const map = new Map<
      string,
      { name: string; color: string; icon: string | null; cents: number }
    >();
    for (const item of items) {
      if (item.type !== 'EXPENSE' || !item.category) continue;
      const root = roots.get(item.category.parentId ?? item.category.id);
      const key = root?.id ?? item.category.id;
      const entry = map.get(key) ?? {
        name: root?.name ?? item.category.name,
        color: root?.color ?? item.category.color ?? '#7a7a80',
        icon: root?.icon ?? item.category.icon,
        cents: 0,
      };
      entry.cents += item.amountCents;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.cents - a.cents);
  }, [items, categories]);
  const total = totals.reduce((sum, entry) => sum + entry.cents, 0);

  return (
    <section aria-labelledby="titulo-categorias-fatura" className="card p-5">
      <h3 id="titulo-categorias-fatura" className="font-semibold">
        Por categoria
      </h3>
      {totals.length === 0 ? (
        <p className="mt-3 text-sm text-slate">Sem compras categorizadas.</p>
      ) : (
        <>
          {/* Barra empilhada: a fatura inteira numa linha só */}
          <div
            className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-sunken"
            aria-hidden="true"
          >
            {totals.map((entry) => (
              <span
                key={entry.name}
                className="h-full"
                style={{ width: `${(entry.cents / total) * 100}%`, background: entry.color }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {totals.slice(0, 6).map((entry) => (
              <li key={entry.name} className="flex items-center gap-2">
                {createElement(categoryIcon(entry.icon), {
                  size: 15,
                  style: { color: entry.color },
                  'aria-hidden': true,
                })}
                <span className="flex-1 truncate">{entry.name}</span>
                <span className="tabular text-[12px] text-faint">
                  {Math.round((entry.cents / total) * 100)}%
                </span>
                <span className="tabular w-24 text-right text-steel">{formatBRL(entry.cents)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function NoCards() {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember-deep">
        <CreditCard size={26} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-5 font-display text-xl font-semibold">Nenhum cartão cadastrado</p>
      <p className="mt-2 max-w-[46ch] text-[15px] text-slate">
        Cadastre um cartão com dia de fechamento e vencimento. As compras lançadas nele formam as
        faturas automaticamente.
      </p>
      <Link
        to="/contas"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-[10px] bg-graphite px-4 text-sm font-medium text-white transition-colors hover:bg-black"
      >
        <Plus size={18} aria-hidden="true" /> Cadastrar cartão
      </Link>
    </div>
  );
}

function NoInvoices({ card }: { card: AccountDto }) {
  return (
    <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember-deep">
        <ReceiptText size={26} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-5 font-display text-xl font-semibold">Nenhuma fatura no {card.name}</p>
      <p className="mt-2 max-w-[46ch] text-[15px] text-slate">
        A primeira fatura aparece quando você lançar uma compra neste cartão.
      </p>
      <Link
        to={`/lancamentos?novo=despesa&conta=${card.id}`}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-[10px] bg-graphite px-4 text-sm font-medium text-white transition-colors hover:bg-black"
      >
        <Plus size={18} aria-hidden="true" /> Lançar compra
      </Link>
    </div>
  );
}
