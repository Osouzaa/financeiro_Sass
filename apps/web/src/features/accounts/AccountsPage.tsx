import { formatBRL, invoiceForPurchase, todayIso, type AccountDto } from '@financeiro/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  CreditCard,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/form';
import { Switch } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { PageHeader } from '@/layout/AppLayout';
import { api } from '@/lib/api';
import { accountTypeMeta, useAccounts } from './account-meta';
import { AccountFormModal } from './AccountFormModal';

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

type Editing = { mode: 'create' } | { mode: 'edit'; account: AccountDto } | null;

export function AccountsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AccountDto | null>(null);
  const { data: accounts = [], isPending } = useAccounts(showArchived);

  const active = accounts.filter((a) => !a.archived);
  const cash = accounts.filter((a) => a.type !== 'CREDIT_CARD');
  const cards = accounts.filter((a) => a.type === 'CREDIT_CARD');

  const totalBalance = active
    .filter((a) => a.type !== 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const totalOwed = active
    .filter((a) => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const totalAvailable = active
    .filter((a) => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + (a.availableLimitCents ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Contas e cartões"
        description="Onde seu dinheiro está e os cartões que você usa. O saldo é calculado a partir dos lançamentos."
        actions={
          <Button type="button" onClick={() => setEditing({ mode: 'create' })}>
            <Plus size={18} aria-hidden="true" /> Nova conta
          </Button>
        }
      />

      <section aria-label="Resumo" className="grid gap-4 sm:grid-cols-3">
        <Summary icon={Landmark} label="Saldo em contas" value={totalBalance} />
        <Summary icon={CreditCard} label="Em aberto nos cartões" value={totalOwed} />
        <Summary icon={WalletCards} label="Limite disponível" value={totalAvailable} />
      </section>

      <div className="mt-8 flex items-center justify-end">
        <Switch checked={showArchived} onChange={setShowArchived} label="Mostrar arquivadas" />
      </div>

      {isPending ? (
        <p className="mt-6 text-slate">Carregando contas…</p>
      ) : accounts.length === 0 ? (
        <EmptyState onCreate={() => setEditing({ mode: 'create' })} />
      ) : (
        <>
          <Group title="Contas" count={cash.length}>
            {cash.length === 0 ? (
              <p className="text-sm text-slate">Nenhuma conta corrente ou carteira ainda.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {cash.map((account) => (
                  <CashAccountCard
                    key={account.id}
                    account={account}
                    onEdit={() => setEditing({ mode: 'edit', account })}
                    onDelete={() => setDeleting(account)}
                  />
                ))}
              </div>
            )}
          </Group>

          <Group title="Cartões de crédito" count={cards.length}>
            {cards.length === 0 ? (
              <p className="text-sm text-slate">Nenhum cartão cadastrado.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {cards.map((account) => (
                  <CreditCardTile
                    key={account.id}
                    account={account}
                    payer={accounts.find((a) => a.id === account.paymentAccountId)}
                    onEdit={() => setEditing({ mode: 'edit', account })}
                    onDelete={() => setDeleting(account)}
                  />
                ))}
              </div>
            )}
          </Group>
        </>
      )}

      {editing ? (
        <AccountFormModal
          account={editing.mode === 'edit' ? editing.account : undefined}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? <DeleteModal account={deleting} onClose={() => setDeleting(null)} /> : null}
    </>
  );
}

function Summary({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-sunken text-steel">
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm text-slate">{label}</p>
        <p
          className={`tabular font-display text-2xl font-semibold tracking-[-0.02em] ${
            value < 0 ? 'text-negative' : ''
          }`}
        >
          {formatBRL(value)}
        </p>
      </div>
    </div>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        {title}
        <span className="tabular rounded-full bg-sunken px-2 py-0.5 text-[12px] font-normal text-slate">
          {count}
        </span>
      </h2>
      {children}
    </section>
  );
}

function useArchive(account: AccountDto) {
  const queryClient = useQueryClient();
  const notify = useToast();
  return useMutation({
    mutationFn: () =>
      api<AccountDto>(`/accounts/${account.id}/${account.archived ? 'unarchive' : 'archive'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      notify(account.archived ? 'Conta reativada' : 'Conta arquivada');
    },
    onError: (error) => notify(error.message, 'error'),
  });
}

function CardActions({
  account,
  onEdit,
  onDelete,
  tone = 'light',
}: {
  account: AccountDto;
  onEdit: () => void;
  onDelete: () => void;
  tone?: 'light' | 'dark';
}) {
  const archive = useArchive(account);
  const base =
    tone === 'light'
      ? 'text-slate hover:bg-sunken hover:text-graphite'
      : 'text-white/70 hover:bg-white/15 hover:text-white';
  const ArchiveIcon = account.archived ? ArchiveRestore : Archive;
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={onEdit}
        className={`grid size-8 place-items-center rounded-[8px] ${base}`}
        aria-label={`Editar ${account.name}`}
        title="Editar"
      >
        <Pencil size={16} />
      </button>
      <button
        type="button"
        onClick={() => archive.mutate()}
        disabled={archive.isPending}
        className={`grid size-8 place-items-center rounded-[8px] ${base}`}
        aria-label={`${account.archived ? 'Reativar' : 'Arquivar'} ${account.name}`}
        title={account.archived ? 'Reativar' : 'Arquivar'}
      >
        <ArchiveIcon size={16} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={`grid size-8 place-items-center rounded-[8px] ${base}`}
        aria-label={`Excluir ${account.name}`}
        title="Excluir"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function CashAccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: AccountDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { label, icon: Icon } = accountTypeMeta(account.type);
  const color = account.color ?? '#7a7a80';
  return (
    <article
      className={`card relative overflow-hidden p-5 ${account.archived ? 'opacity-60' : ''}`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 place-items-center rounded-[10px]"
            style={{ background: `${color}1a`, color }}
          >
            <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold leading-tight">{account.name}</h3>
            <p className="text-[13px] text-slate">
              {label}
              {account.archived ? ' · Arquivada' : ''}
            </p>
          </div>
        </div>
        <CardActions account={account} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <p className="mt-5 text-[13px] text-slate">Saldo atual</p>
      <p
        className={`tabular font-display text-[26px] leading-tight font-semibold tracking-[-0.02em] ${
          account.balanceCents < 0 ? 'text-negative' : ''
        }`}
      >
        {formatBRL(account.balanceCents)}
      </p>
      <p className="mt-1 text-[12px] text-faint">
        Saldo inicial de {formatBRL(account.initialBalanceCents)} em{' '}
        {shortDate(account.initialBalanceDate)}
      </p>
      <Link
        to={`/lancamentos?conta=${account.id}`}
        className="link-ember mt-3 inline-block text-sm"
      >
        Ver lançamentos
      </Link>
    </article>
  );
}

function CreditCardTile({
  account,
  payer,
  onEdit,
  onDelete,
}: {
  account: AccountDto;
  payer?: AccountDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = account.color ?? '#1d1d1f';
  const limit = account.creditLimitCents ?? 0;
  const used = Math.max(0, account.balanceCents);
  const usedPercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const invoice =
    account.closingDay && account.dueDay
      ? invoiceForPurchase(todayIso(), { closingDay: account.closingDay, dueDay: account.dueDay })
      : null;

  return (
    <article className={`card overflow-hidden ${account.archived ? 'opacity-60' : ''}`}>
      <div
        className="relative p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${color} 0%, #141414 130%)` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] text-white/70">
              Cartão de crédito{account.archived ? ' · Arquivado' : ''}
            </p>
            <h3 className="text-lg font-semibold">{account.name}</h3>
          </div>
          <CardActions account={account} onEdit={onEdit} onDelete={onDelete} tone="dark" />
        </div>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] text-white/65">Em aberto</p>
            <p className="tabular font-display text-[26px] leading-tight font-semibold">
              {formatBRL(account.balanceCents)}
            </p>
          </div>
          <span className="h-7 w-10 rounded-[6px] bg-gradient-to-br from-[#e9c98f] to-[#b38b4d]" />
        </div>
      </div>
      <div className="space-y-3 p-5">
        <div>
          <div className="flex justify-between text-[13px]">
            <span className="text-slate">Limite usado</span>
            <span className="tabular text-steel">
              {formatBRL(used)} de {formatBRL(limit)}
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"
            role="progressbar"
            aria-valuenow={Math.round(usedPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Limite usado"
          >
            <div
              className={`h-full rounded-full ${usedPercent >= 90 ? 'bg-negative' : 'bg-ember'}`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <p className="tabular mt-1.5 text-[13px] text-slate">
            Disponível: {formatBRL(account.availableLimitCents ?? 0)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-[13px]">
          <div>
            <dt className="text-slate">Fatura atual</dt>
            <dd className="tabular">
              {invoice
                ? `Fecha ${shortDate(invoice.closingDate)} · vence ${shortDate(invoice.dueDate)}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate">Pago com</dt>
            <dd className="truncate">{payer?.name ?? 'Não definido'}</dd>
          </div>
        </dl>
        <Link to={`/faturas?cartao=${account.id}`} className="link-ember inline-block text-sm">
          Ver faturas
        </Link>
      </div>
    </article>
  );
}

function DeleteModal({ account, onClose }: { account: AccountDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const remove = useMutation({
    mutationFn: () => api(`/accounts/${account.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      notify('Conta excluída');
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Excluir ${account.name}?`}
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
        A exclusão não pode ser desfeita. Contas com lançamentos não podem ser excluídas; nesse
        caso, arquive para tirá-la das listas sem perder o histórico.
      </p>
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember-deep">
        <WalletCards size={26} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-5 font-display text-xl font-semibold">Cadastre sua primeira conta</p>
      <p className="mt-2 max-w-[46ch] text-[15px] text-slate">
        Comece pela conta onde você recebe o salário. Depois, adicione seus cartões de crédito com
        dia de fechamento e vencimento.
      </p>
      <Button type="button" className="mt-6" onClick={onCreate}>
        <Plus size={18} aria-hidden="true" /> Nova conta
      </Button>
    </div>
  );
}
