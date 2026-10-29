import {
  subscriptionStatusLabels,
  type AdminSubscriptionInput,
  type AdminUserDto,
  type SubscriptionStatus,
} from '@financeiro/shared';
import { useMutation } from '@tanstack/react-query';
import { BadgeCheck, Ban, ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, FormAlert, TextField } from '@/components/form';
import { Field, Select } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/dates';
import { useAdminPlans, useAdminUsers, useInvalidateAdmin } from './admin-api';

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const dateBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim()).slice(0, 100);
  const { data, isPending, isFetching, error } = useAdminUsers(q, page);
  const [editing, setEditing] = useState<AdminUserDto | null>(null);
  const [toggling, setToggling] = useState<AdminUserDto | null>(null);
  const { user: me } = useAuth();
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[260px] flex-1">
          <span className="sr-only">Buscar por nome, e-mail ou CPF</span>
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            maxLength={100}
            placeholder="Buscar por nome, e-mail ou CPF"
            className="h-11 w-full rounded-[10px] border border-line-strong bg-surface pr-4 pl-11 text-[15px] placeholder:text-faint hover:border-faint focus:border-ember focus:ring-4 focus:ring-ember-soft focus:outline-none"
          />
        </label>
        {data ? (
          <span className="tabular text-sm text-slate">
            {data.total} {data.total === 1 ? 'conta' : 'contas'}
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-[12px] bg-negative-soft px-4 py-3 text-sm text-negative">
          {error.message}
        </p>
      ) : isPending ? (
        <div className="card h-[300px] animate-pulse bg-sunken/40" aria-hidden="true" />
      ) : (
        <div className={`card overflow-x-auto ${isFetching ? 'opacity-70' : ''}`}>
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-slate">
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 font-medium">CPF</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Uso</th>
                <th className="px-4 py-3 font-medium">Desde</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data?.items.map((row) => (
                <tr
                  key={row.id}
                  className={row.status === 'SUSPENDED' ? 'bg-negative-soft/30' : ''}
                >
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 font-medium">
                      {row.name}
                      {row.role === 'SUPER_ADMIN' ? (
                        <ShieldCheck
                          size={14}
                          className="text-ember-deep"
                          aria-label="Super admin"
                        />
                      ) : null}
                    </p>
                    <p className="flex items-center gap-1 text-[12px] text-slate">
                      {row.email}
                      {row.emailVerified ? (
                        <BadgeCheck
                          size={13}
                          className="text-positive"
                          aria-label="E-mail confirmado"
                        />
                      ) : null}
                    </p>
                    {row.status === 'SUSPENDED' ? (
                      <span className="mt-1 inline-block rounded-full bg-negative px-2 py-px text-[11px] font-semibold text-white">
                        Suspensa
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular px-4 py-3 text-steel">{row.cpfMasked ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.plan.name}</p>
                    <p className="text-[12px] text-slate">
                      {row.subscriptionStatus
                        ? subscriptionStatusLabels[row.subscriptionStatus]
                        : 'Sem assinatura'}
                      {row.currentPeriodEnd
                        ? ` · até ${formatShortDate(row.currentPeriodEnd)}`
                        : ''}
                    </p>
                  </td>
                  <td className="tabular px-4 py-3 text-[12px] text-steel">
                    {row.usage.accounts} contas · {row.usage.cards} cartões
                    <br />
                    {row.usage.recurrences} recorr. · {row.usage.budgets} orç.
                  </td>
                  <td className="px-4 py-3 text-steel">{dateBR(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" onClick={() => setEditing(row)}>
                        Plano
                      </Button>
                      {row.id !== me?.id ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setToggling(row)}
                          className={row.status === 'SUSPENDED' ? '' : '!text-negative'}
                        >
                          {row.status === 'SUSPENDED' ? 'Reativar' : 'Suspender'}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate">
                    Nenhuma conta encontrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
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
        </div>
      ) : null}

      {editing ? <SubscriptionModal user={editing} onClose={() => setEditing(null)} /> : null}
      {toggling ? <StatusModal user={toggling} onClose={() => setToggling(null)} /> : null}
    </>
  );
}

const STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED'];

function SubscriptionModal({ user, onClose }: { user: AdminUserDto; onClose: () => void }) {
  const { data: plans = [] } = useAdminPlans();
  const invalidate = useInvalidateAdmin();
  const notify = useToast();
  const [form, setForm] = useState<AdminSubscriptionInput>({
    planId: user.plan.id,
    status: user.subscriptionStatus ?? 'ACTIVE',
    currentPeriodEnd: user.currentPeriodEnd,
  });
  const save = useMutation({
    mutationFn: () => api(`/admin/users/${user.id}/subscription`, { method: 'PUT', body: form }),
    onSuccess: () => {
      void invalidate();
      notify(`Plano de ${user.name} atualizado`);
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Plano de ${user.name}`}
      description={user.email}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormAlert message={save.error?.message} />
        <Field label="Plano">
          <Select
            value={form.planId}
            onChange={(event) => setForm({ ...form, planId: event.target.value })}
          >
            {plans
              .filter((plan) => plan.isActive)
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                  {plan.isPublic ? '' : ' (fora da vitrine)'}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Situação da assinatura">
          <Select
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value as SubscriptionStatus })
            }
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {subscriptionStatusLabels[status]}
              </option>
            ))}
          </Select>
        </Field>
        <TextField
          label="Válida até (opcional)"
          type="date"
          value={form.currentPeriodEnd ?? ''}
          onChange={(event) => setForm({ ...form, currentPeriodEnd: event.target.value || null })}
          hint="Sem data, vale até ser alterada. Depois da data, a conta volta para o Grátis."
        />
      </div>
    </Modal>
  );
}

function StatusModal({ user, onClose }: { user: AdminUserDto; onClose: () => void }) {
  const invalidate = useInvalidateAdmin();
  const notify = useToast();
  const suspended = user.status === 'SUSPENDED';
  const change = useMutation({
    mutationFn: () =>
      api(`/admin/users/${user.id}/${suspended ? 'reactivate' : 'suspend'}`, { method: 'POST' }),
    onSuccess: () => {
      void invalidate();
      notify(suspended ? `${user.name} reativada` : `${user.name} suspensa`);
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={suspended ? `Reativar ${user.name}?` : `Suspender ${user.name}?`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            loading={change.isPending}
            onClick={() => change.mutate()}
            className={suspended ? '' : '!bg-negative hover:!bg-[#a92e26]'}
          >
            {suspended ? (
              'Reativar'
            ) : (
              <>
                <Ban size={16} aria-hidden="true" /> Suspender
              </>
            )}
          </Button>
        </>
      }
    >
      <FormAlert message={change.error?.message} />
      <p className="text-[15px] text-steel">
        {suspended
          ? 'A pessoa volta a conseguir entrar. Os dados continuam como estavam.'
          : 'Todas as sessões são encerradas na hora e a pessoa não consegue entrar até ser reativada. Nenhum dado é apagado.'}
      </p>
    </Modal>
  );
}
