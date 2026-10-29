import {
  formatBRL,
  paymentStatusLabels,
  type AdminBillingDto,
  type AdminPaymentDto,
  type PageDto,
  type PaymentStatus,
} from '@financeiro/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Copy, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/form';
import { Select } from '@/components/inputs';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const EVENT_STATUS: Record<string, { label: string; tone: string }> = {
  PROCESSED: { label: 'Processado', tone: 'text-positive' },
  IGNORED: { label: 'Ignorado', tone: 'text-slate' },
  RECEIVED: { label: 'Recebido', tone: 'text-slate' },
  FAILED: { label: 'Falhou', tone: 'text-negative' },
  REJECTED: { label: 'Assinatura inválida', tone: 'text-negative' },
};

const EVENT_TYPES: Record<string, string> = {
  subscription_preapproval: 'Assinatura',
  subscription_authorized_payment: 'Cobrança',
  payment: 'Pagamento',
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function AdminBillingPage() {
  const { data: summary, error } = useQuery({
    queryKey: ['admin', 'billing'],
    queryFn: () => api<AdminBillingDto>('/admin/billing'),
  });

  if (error) {
    return (
      <p role="alert" className="rounded-[12px] bg-negative-soft px-4 py-3 text-sm text-negative">
        {error.message}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {summary ? <IntegrationStatus summary={summary} /> : null}
      {summary ? (
        <section aria-label="Números do mês" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Figure
            label="Recebido no mês"
            value={formatBRL(summary.revenueMonthCents)}
            note={`${summary.approvedMonth} cobranças aprovadas`}
          />
          <Figure
            label="Cobranças recusadas no mês"
            value={String(summary.failedMonth)}
            tone={summary.failedMonth > 0 ? 'text-negative' : undefined}
          />
          <Figure
            label="Assinaturas"
            value={String(summary.active + summary.trialing)}
            note={`${summary.active} ativas, ${summary.trialing} em teste, ${summary.pastDue} com pagamento pendente`}
          />
        </section>
      ) : (
        <div className="card h-[200px] animate-pulse bg-sunken/40" aria-hidden="true" />
      )}
      <PaymentsTable />
      {summary ? <EventsLog events={summary.events} /> : null}
    </div>
  );
}

function IntegrationStatus({ summary }: { summary: AdminBillingDto }) {
  const notify = useToast();
  const ok = summary.configured && summary.webhookSecretConfigured;
  return (
    <section aria-labelledby="titulo-integracao" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="titulo-integracao" className="flex items-center gap-2 text-lg font-semibold">
            {ok ? (
              <CircleCheck size={20} className="text-positive" aria-hidden="true" />
            ) : (
              <CircleAlert size={20} className="text-[#d69a1c]" aria-hidden="true" />
            )}
            Mercado Pago
          </h2>
          <p className="mt-1 text-sm text-steel">
            {!summary.configured
              ? 'Sem credenciais: defina MP_ACCESS_TOKEN na API para ligar a cobrança.'
              : summary.mode === 'test'
                ? 'Ligado com credenciais de teste. Nenhum cartão real é cobrado.'
                : 'Ligado em produção: cobranças reais.'}
          </p>
        </div>
        {summary.mode ? (
          <span
            className={`rounded-full px-3 py-1 text-[13px] font-medium ${
              summary.mode === 'test' ? 'bg-[#fff1c2] text-brass' : 'bg-positive-soft text-positive'
            }`}
          >
            {summary.mode === 'test' ? 'Modo teste' : 'Produção'}
          </span>
        ) : null}
      </div>
      <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate">Webhook (cadastre no painel do Mercado Pago)</dt>
          <dd className="mt-1 flex items-center gap-2">
            {summary.webhookUrl ? (
              <>
                <code className="min-w-0 truncate rounded-[6px] bg-sunken px-2 py-1 text-[13px]">
                  {summary.webhookUrl}
                </code>
                <button
                  type="button"
                  className="grid size-8 shrink-0 place-items-center rounded-[8px] text-slate hover:bg-sunken"
                  aria-label="Copiar endereço do webhook"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(summary.webhookUrl!)
                      .then(() => notify('Endereço copiado'));
                  }}
                >
                  <Copy size={15} />
                </button>
              </>
            ) : (
              <span className="text-steel">Defina API_PUBLIC_URL na API para ver o endereço.</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate">Chave secreta do webhook</dt>
          <dd
            className={`mt-1 ${summary.webhookSecretConfigured ? 'text-positive' : 'text-negative'}`}
          >
            {summary.webhookSecretConfigured
              ? 'Configurada: só avisos assinados são aceitos'
              : 'Não configurada (MP_WEBHOOK_SECRET). Em produção, a API não sobe sem ela.'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Figure({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate">{label}</p>
      <p
        className={`tabular mt-2 font-display text-[28px] leading-none font-semibold tracking-[-0.02em] ${tone ?? ''}`}
      >
        {value}
      </p>
      {note ? <p className="mt-2 text-[13px] text-slate">{note}</p> : null}
    </div>
  );
}

const STATUSES: PaymentStatus[] = ['APPROVED', 'PENDING', 'REJECTED', 'REFUNDED'];

function PaymentsTable() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim()).slice(0, 100);
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'payments', { q, status, page }],
    queryFn: () => api<PageDto<AdminPaymentDto>>(`/admin/payments?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section aria-labelledby="titulo-cobrancas" className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <h2 id="titulo-cobrancas" className="mr-auto font-semibold">
          Cobranças
        </h2>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Buscar por e-mail, nome ou id</span>
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="E-mail, nome ou id do Mercado Pago"
            className="h-10 w-full rounded-[10px] border border-line-strong bg-surface pr-3 pl-9 text-sm placeholder:text-faint focus:border-ember focus:ring-4 focus:ring-ember-soft focus:outline-none"
          />
        </label>
        <Select
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as PaymentStatus | '');
            setPage(1);
          }}
          className="!h-10 !w-auto text-sm"
        >
          <option value="">Todos os status</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {paymentStatusLabels[value]}
            </option>
          ))}
        </Select>
      </header>
      {isPending ? (
        <div className="h-[200px] animate-pulse bg-sunken/40" aria-hidden="true" />
      ) : data?.items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate">Nenhuma cobrança encontrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-slate">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Pessoa</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Id no Mercado Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data?.items.map((payment) => (
                <tr key={payment.id}>
                  <td className="tabular px-4 py-3 text-steel">
                    {when.format(new Date(payment.paidAt ?? payment.createdAt))}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{payment.user?.name ?? 'Conta excluída'}</p>
                    <p className="text-[12px] text-slate">
                      {payment.user?.email ?? payment.payerEmail}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-steel">{payment.description}</td>
                  <td className="tabular px-4 py-3 text-right font-medium">
                    {formatBRL(payment.amountCents)}
                  </td>
                  <td
                    className={`px-4 py-3 ${
                      payment.status === 'APPROVED'
                        ? 'text-positive'
                        : payment.status === 'REJECTED'
                          ? 'text-negative'
                          : 'text-slate'
                    }`}
                  >
                    {paymentStatusLabels[payment.status]}
                  </td>
                  <td className="tabular px-4 py-3 text-[12px] text-slate">
                    {payment.providerPaymentId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <footer className="flex items-center justify-end gap-2 border-t border-line p-3 text-sm">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="tabular text-slate">
            {page} de {pages}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight size={16} />
          </Button>
        </footer>
      ) : null}
    </section>
  );
}

function EventsLog({ events }: { events: AdminBillingDto['events'] }) {
  return (
    <section aria-labelledby="titulo-avisos" className="card overflow-hidden">
      <header className="border-b border-line p-4">
        <h2 id="titulo-avisos" className="font-semibold">
          Avisos do Mercado Pago
        </h2>
        <p className="text-sm text-slate">
          Os 20 mais recentes. Avisos com falha são reprocessados quando o Mercado Pago reenvia.
        </p>
      </header>
      {events.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate">Nenhum aviso recebido ainda.</p>
      ) : (
        <ol className="divide-y divide-line">
          {events.map((event) => {
            const status = EVENT_STATUS[event.status] ?? {
              label: event.status,
              tone: 'text-slate',
            };
            return (
              <li
                key={event.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4"
              >
                <time
                  className="tabular w-32 shrink-0 text-[12px] text-slate"
                  dateTime={event.createdAt}
                >
                  {when.format(new Date(event.createdAt))}
                </time>
                <span className="w-28 shrink-0">{EVENT_TYPES[event.type] ?? event.type}</span>
                <span className="tabular min-w-0 flex-1 truncate text-[12px] text-slate">
                  {event.resourceId ?? 'sem id'}
                </span>
                <span className={`shrink-0 text-[13px] font-medium ${status.tone}`}>
                  {status.label}
                </span>
                {event.error ? (
                  <span className="w-full truncate text-[12px] text-negative sm:w-auto">
                    {event.error}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
