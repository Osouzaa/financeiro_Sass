import {
  invoiceForPurchase,
  isValidIsoDate,
  todayIso,
  transactionInputSchema,
  transferInputSchema,
  type RecurrenceDto,
  type RecurrenceFrequency,
  type TransactionDto,
  type TransactionInput,
  type TransactionInputParsed,
  type TransferInput,
  type TransferInputParsed,
} from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowUpRight,
  CreditCard,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type BaseSyntheticEvent } from 'react';
import {
  Controller,
  useForm,
  useWatch,
  type FieldValues,
  type UseFormRegisterReturn,
  type UseFormSetError,
} from 'react-hook-form';
import { Button, FormAlert, TextField } from '@/components/form';
import { CurrencyInput, Field, Select, Switch } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { AccountOptions } from '@/features/accounts/AccountOptions';
import { selectableAccounts, useAccounts } from '@/features/accounts/account-meta';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { CategoryFormModal } from '@/features/categories/CategoryFormModal';
import { useCategories } from '@/features/categories/use-categories';
import { api, ApiError } from '@/lib/api';
import { formatShortDate } from '@/lib/dates';
import {
  InstallmentsPanel,
  RecurringPanel,
  RepeatPicker,
  ScopePicker,
  type RepeatMode,
  type Scope,
} from './RepeatOptions';
import { useInvalidateMoney } from './transaction-api';

export type FormMode = 'EXPENSE' | 'INCOME' | 'TRANSFER';

export type FormTarget =
  | { mode: 'create'; type: FormMode; accountId?: string }
  | { mode: 'edit'; transaction: TransactionDto };

const TABS: Record<FormMode, { label: string; icon: LucideIcon; active: string }> = {
  EXPENSE: { label: 'Despesa', icon: ArrowUpRight, active: 'bg-surface text-negative shadow-sm' },
  INCOME: { label: 'Receita', icon: ArrowDownLeft, active: 'bg-surface text-positive shadow-sm' },
  TRANSFER: {
    label: 'Transferência',
    icon: ArrowLeftRight,
    active: 'bg-surface text-graphite shadow-sm',
  },
};

const FORM_ID = 'transaction-form';

/** Modal de lançamento. Montado só quando aberto, para sempre começar limpo. */
export function TransactionFormModal({
  target,
  onClose,
  onDelete,
}: {
  target: FormTarget;
  onClose: () => void;
  onDelete: (transaction: TransactionDto) => void;
}) {
  const editing = target.mode === 'edit' ? target.transaction : undefined;
  const [mode, setMode] = useState<FormMode>(
    target.mode === 'edit' ? target.transaction.type : target.type,
  );
  const [submitting, setSubmitting] = useState(false);

  // Na edição, receita e despesa podem trocar entre si; transferência continua transferência
  const tabs: FormMode[] = editing
    ? editing.type === 'TRANSFER'
      ? ['TRANSFER']
      : ['EXPENSE', 'INCOME']
    : ['EXPENSE', 'INCOME', 'TRANSFER'];

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar lançamento' : 'Novo lançamento'}
      footer={
        <>
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto !text-negative hover:!bg-negative-soft"
              onClick={() => onDelete(editing)}
            >
              <Trash2 size={16} aria-hidden="true" /> Excluir
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {!editing ? (
            <Button
              type="submit"
              form={FORM_ID}
              variant="secondary"
              data-again="true"
              disabled={submitting}
              className="hidden sm:inline-flex"
            >
              Salvar e lançar outra
            </Button>
          ) : null}
          <Button type="submit" form={FORM_ID} loading={submitting}>
            {editing ? 'Salvar' : 'Lançar'}
          </Button>
        </>
      }
    >
      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Tipo"
          className="mb-5 flex gap-1 rounded-[12px] bg-sunken p-1"
        >
          {tabs.map((tab) => {
            const { label, icon: Icon, active } = TABS[tab];
            const selected = mode === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setMode(tab)}
                className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[9px] text-sm font-medium transition-colors ${
                  selected ? active : 'text-slate hover:text-graphite'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {mode === 'TRANSFER' ? (
        <TransferForm
          transaction={editing}
          defaultAccountId={target.mode === 'create' ? target.accountId : undefined}
          onDone={onClose}
          onSubmittingChange={setSubmitting}
        />
      ) : (
        <EntryForm
          type={mode}
          transaction={editing}
          defaultAccountId={target.mode === 'create' ? target.accountId : undefined}
          onDone={onClose}
          onSubmittingChange={setSubmitting}
        />
      )}
    </Modal>
  );
}

interface FormProps {
  transaction?: TransactionDto;
  defaultAccountId?: string;
  onDone: () => void;
  onSubmittingChange: (submitting: boolean) => void;
}

/** O botão "Salvar e lançar outra" marca o envio para manter o modal aberto. */
const wantsAnother = (event?: BaseSyntheticEvent) =>
  (event?.nativeEvent as SubmitEvent | undefined)?.submitter?.dataset.again === 'true';

/** Erros por campo vão para o campo; os demais aparecem no topo do formulário. */
function handleError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  setFormError: (message: string) => void,
) {
  const message = applyServerErrors(error, setError);
  if (!(error instanceof ApiError) || Object.keys(error.fields).length === 0) {
    setFormError(message);
  }
}

function EntryForm({
  type,
  transaction,
  defaultAccountId,
  onDone,
  onSubmittingChange,
}: FormProps & { type: 'EXPENSE' | 'INCOME' }) {
  const notify = useToast();
  const invalidate = useInvalidateMoney();
  const { data: activeAccounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const [formError, setFormError] = useState<string>();
  const [showNotes, setShowNotes] = useState(Boolean(transaction?.notes));
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [repeatChoice, setRepeat] = useState<RepeatMode>('once');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('MONTHLY');
  const [endDate, setEndDate] = useState('');
  const [endError, setEndError] = useState<string>();
  const [scope, setScope] = useState<Scope>('this');
  const today = todayIso();
  const hasSeries = Boolean(transaction?.installment || transaction?.recurrenceId);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<TransactionInput, unknown, TransactionInputParsed>({
    resolver: zodResolver(transactionInputSchema),
    defaultValues: transaction
      ? {
          type,
          accountId: transaction.account.id,
          categoryId: transaction.category?.id ?? '',
          amountCents: transaction.amountCents,
          description: transaction.description,
          notes: transaction.notes,
          date: transaction.date,
          status: transaction.status,
          installments: 1,
        }
      : {
          type,
          accountId: defaultAccountId ?? '',
          categoryId: '',
          amountCents: 0,
          description: '',
          notes: null,
          date: today,
          status: 'PAID',
          installments: 1,
        },
  });

  useEffect(() => onSubmittingChange(isSubmitting), [isSubmitting, onSubmittingChange]);

  // Receita não parcela: ao trocar de aba, vale como lançamento único
  const repeat: RepeatMode =
    type === 'INCOME' && repeatChoice === 'installments' ? 'once' : repeatChoice;

  const accounts = useMemo(
    () => selectableAccounts(activeAccounts, [transaction?.account]),
    [activeAccounts, transaction?.account],
  );
  const [accountId, categoryId, date, status, amountCents, installments] = useWatch({
    control,
    name: ['accountId', 'categoryId', 'date', 'status', 'amountCents', 'installments'],
  });

  // Primeira conta como padrão assim que a lista carregar
  useEffect(() => {
    if (!getValues('accountId') && accounts[0]) setValue('accountId', accounts[0].id);
  }, [accounts, getValues, setValue]);

  // Trocar entre receita e despesa limpa a categoria, que é de um tipo só
  const options = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  useEffect(() => {
    setValue('type', type);
    const current = getValues('categoryId');
    const valid = options.some((c) => c.id === current || c.children.some((s) => s.id === current));
    if (current && categories.length && !valid) setValue('categoryId', '');
  }, [type, categories.length, options, getValues, setValue]);

  const account = accounts.find((a) => a.id === accountId);
  const fullAccount = activeAccounts.find((a) => a.id === accountId);
  const isCard = account?.type === 'CREDIT_CARD';
  const isFuture = isValidIsoDate(date) && date > today;
  const cycle =
    isCard && fullAccount?.closingDay && fullAccount.dueDay
      ? { closingDay: fullAccount.closingDay, dueDay: fullAccount.dueDay }
      : null;
  const invoice = cycle && isValidIsoDate(date) ? invoiceForPurchase(date, cycle) : null;

  const onSubmit = handleSubmit(async (values, event) => {
    setFormError(undefined);
    setEndError(undefined);
    try {
      if (!transaction && repeat === 'recurring') {
        await api<RecurrenceDto>('/recurrences', {
          method: 'POST',
          body: {
            type: values.type,
            accountId: values.accountId,
            categoryId: values.categoryId,
            amountCents: values.amountCents,
            description: values.description,
            frequency,
            startDate: values.date,
            endDate: endDate || null,
          },
        });
        await invalidate();
        notify('Recorrência criada: os próximos lançamentos já estão previstos');
        onDone();
        return;
      }
      const query = transaction && hasSeries ? `?scope=${scope}` : '';
      await api<TransactionDto>(
        transaction ? `/transactions/${transaction.id}${query}` : '/transactions',
        {
          method: transaction ? 'PUT' : 'POST',
          body: { ...values, installments: repeat === 'installments' ? values.installments : 1 },
        },
      );
      await invalidate();
      notify(
        transaction
          ? 'Lançamento atualizado'
          : repeat === 'installments'
            ? `Compra lançada em ${values.installments}x`
            : type === 'INCOME'
              ? 'Receita lançada'
              : 'Despesa lançada',
      );
      if (wantsAnother(event)) {
        // Mantém conta, categoria e data: o próximo gasto costuma ser parecido
        reset({ ...values, amountCents: 0, description: '', notes: null, installments: 1 });
        setRepeat('once');
        setShowNotes(false);
        setFocus('amountCents');
      } else {
        onDone();
      }
    } catch (caught) {
      let error = caught;
      // Na recorrência, a data de início é o campo Data e o fim tem campo próprio
      if (error instanceof ApiError) {
        const { startDate, endDate: endMessages, ...fields } = error.fields;
        if (startDate) fields.date = startDate;
        if (endMessages?.[0]) setEndError(endMessages[0]);
        error = new ApiError(error.status, error.message, fields);
      }
      handleError(error, setError, setFormError);
    }
  });

  return (
    <>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={formError} />

        <Controller
          control={control}
          name="amountCents"
          render={({ field }) => (
            <Field
              label={
                repeat === 'installments'
                  ? 'Valor total da compra'
                  : transaction?.installment
                    ? 'Valor da parcela'
                    : 'Valor'
              }
              error={errors.amountCents?.message}
            >
              <CurrencyInput
                ref={field.ref}
                size="lg"
                value={field.value}
                onChange={field.onChange}
                error={errors.amountCents?.message}
                aria-label="Valor"
                autoFocus={!transaction}
              />
            </Field>
          )}
        />

        {!transaction ? (
          <RepeatPicker
            value={repeat}
            allowInstallments={type === 'EXPENSE'}
            onChange={(mode) => {
              setRepeat(mode);
              if (mode === 'installments' && (getValues('installments') ?? 1) < 2) {
                setValue('installments', 2);
              }
            }}
          />
        ) : null}

        <TextField
          label="Descrição"
          placeholder={type === 'INCOME' ? 'Ex.: Salário, Freela' : 'Ex.: Mercado, Uber'}
          autoComplete="off"
          maxLength={200}
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Categoria"
            error={errors.categoryId?.message}
            labelAside={
              <button
                type="button"
                onClick={() => setCreatingCategory(true)}
                className="link-ember text-[13px]"
              >
                + Nova
              </button>
            }
          >
            <Select error={errors.categoryId?.message} {...register('categoryId')}>
              <option value="" disabled>
                Escolha
              </option>
              {options.map((category) =>
                category.children.length ? (
                  <optgroup key={category.id} label={category.name}>
                    <option value={category.id}>{category.name} (geral)</option>
                    {category.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ),
              )}
              {/* Categoria arquivada depois do lançamento continua visível na edição */}
              {transaction?.category &&
              categoryId === transaction.category.id &&
              !options.some(
                (c) => c.id === categoryId || c.children.some((s) => s.id === categoryId),
              ) ? (
                <option value={transaction.category.id}>{transaction.category.name}</option>
              ) : null}
            </Select>
          </Field>

          <TextField
            label={
              repeat === 'recurring'
                ? 'Primeira em'
                : repeat === 'installments'
                  ? 'Data da compra'
                  : 'Data'
            }
            type="date"
            error={errors.date?.message}
            {...register('date', {
              onChange: (event: { target: { value: string } }) => {
                if (event.target.value > today) setValue('status', 'PLANNED');
              },
            })}
          />
        </div>

        <Field
          label={type === 'INCOME' ? 'Recebido em' : 'Pago com'}
          error={errors.accountId?.message}
        >
          <Select error={errors.accountId?.message} {...register('accountId')}>
            <option value="" disabled>
              Escolha
            </option>
            <AccountOptions accounts={accounts} />
          </Select>
        </Field>

        {repeat === 'installments' ? (
          <InstallmentsPanel
            totalCents={amountCents ?? 0}
            count={Number(installments)}
            date={date}
            cycle={cycle}
            error={errors.installments?.message}
            registration={register('installments', { valueAsNumber: true })}
          />
        ) : null}
        {repeat === 'recurring' ? (
          <RecurringPanel
            frequency={frequency}
            onFrequency={setFrequency}
            endDate={endDate}
            onEndDate={setEndDate}
            startDate={date}
            endError={endError}
          />
        ) : null}

        {repeat !== 'once' ? null : isCard ? (
          <div className="flex items-start gap-3 rounded-[12px] border border-line bg-canvas px-4 py-3 text-sm">
            <CreditCard size={18} className="mt-0.5 shrink-0 text-ember-deep" aria-hidden="true" />
            <p className="text-steel">
              {type === 'INCOME' ? 'Estorno abatido' : 'Entra'} na fatura{' '}
              {invoice ? (
                <>
                  que fecha em{' '}
                  <strong className="tabular">{formatShortDate(invoice.closingDate)}</strong> e
                  vence em <strong className="tabular">{formatShortDate(invoice.dueDate)}</strong>.
                </>
              ) : (
                'do período.'
              )}{' '}
              O dinheiro sai da conta quando a fatura for paga.
            </p>
          </div>
        ) : (
          <div>
            <Switch
              checked={status === 'PAID'}
              onChange={(checked) => setValue('status', checked ? 'PAID' : 'PLANNED')}
              disabled={isFuture}
              label={type === 'INCOME' ? 'Já recebi' : 'Já paguei'}
              description={
                isFuture
                  ? 'Datas futuras ficam como previstas e entram na projeção.'
                  : 'Desligado, fica como previsto e não mexe no saldo atual.'
              }
            />
            {errors.status?.message ? (
              <p className="mt-1.5 text-[13px] text-negative">{errors.status.message}</p>
            ) : null}
          </div>
        )}

        {transaction && hasSeries ? (
          <ScopePicker transaction={transaction} value={scope} onChange={setScope} />
        ) : null}

        {repeat !== 'recurring' ? (
          <NotesField
            open={showNotes}
            onOpen={() => setShowNotes(true)}
            error={errors.notes?.message}
            registration={register('notes')}
          />
        ) : null}
      </form>
      {/* Fora do <form>: um formulário dentro de outro enviaria o lançamento junto */}
      {creatingCategory ? (
        <CategoryFormModal
          type={type}
          lockType
          onClose={() => setCreatingCategory(false)}
          onSaved={(category) => setValue('categoryId', category.id, { shouldValidate: true })}
        />
      ) : null}
    </>
  );
}

function TransferForm({ transaction, defaultAccountId, onDone, onSubmittingChange }: FormProps) {
  const notify = useToast();
  const invalidate = useInvalidateMoney();
  const { data: activeAccounts = [] } = useAccounts();
  const [formError, setFormError] = useState<string>();
  const [showNotes, setShowNotes] = useState(Boolean(transaction?.notes));
  const today = todayIso();

  // A ponta OUT é a origem; na edição, o lançamento pode ser qualquer uma das duas
  const transfer = transaction?.transfer;
  const origin = transfer?.direction === 'IN' ? transfer.counterpart : transaction?.account;
  const destination = transfer?.direction === 'IN' ? transaction?.account : transfer?.counterpart;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    reset,
    setFocus,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<TransferInput, unknown, TransferInputParsed>({
    resolver: zodResolver(transferInputSchema),
    defaultValues: transaction
      ? {
          fromAccountId: origin?.id ?? '',
          toAccountId: destination?.id ?? '',
          amountCents: transaction.amountCents,
          description: transaction.description,
          notes: transaction.notes,
          date: transaction.date,
          status: transaction.status,
        }
      : {
          fromAccountId: '',
          toAccountId: '',
          amountCents: 0,
          description: 'Transferência',
          notes: null,
          date: today,
          status: 'PAID',
        },
  });

  useEffect(() => onSubmittingChange(isSubmitting), [isSubmitting, onSubmittingChange]);

  const accounts = useMemo(
    () => selectableAccounts(activeAccounts, [origin, destination]),
    [activeAccounts, origin, destination],
  );
  const sources = useMemo(() => accounts.filter((a) => a.type !== 'CREDIT_CARD'), [accounts]);
  const [fromAccountId, toAccountId, date, status] = useWatch({
    control,
    name: ['fromAccountId', 'toAccountId', 'date', 'status'],
  });
  const targets = accounts.filter((a) => a.id !== fromAccountId);
  const toCard = accounts.find((a) => a.id === toAccountId && a.type === 'CREDIT_CARD');
  const isFuture = isValidIsoDate(date) && date > today;

  // Origem padrão: a conta de onde se abriu o formulário, ou a primeira conta corrente
  useEffect(() => {
    if (getValues('fromAccountId') || !sources[0]) return;
    const preferred = sources.find((a) => a.id === defaultAccountId) ?? sources[0];
    setValue('fromAccountId', preferred.id);
  }, [sources, defaultAccountId, getValues, setValue]);

  // Pagar o cartão é uma transferência: sugere a descrição enquanto o usuário não mexer nela
  useEffect(() => {
    if (transaction || dirtyFields.description) return;
    setValue('description', toCard ? `Pagamento da fatura ${toCard.name}` : 'Transferência');
  }, [toCard, transaction, dirtyFields.description, setValue]);

  const swap = () => {
    const { fromAccountId: from, toAccountId: to } = getValues();
    if (!to || accounts.find((a) => a.id === to)?.type === 'CREDIT_CARD') return;
    setValue('fromAccountId', to);
    setValue('toAccountId', from);
  };

  const onSubmit = handleSubmit(async (values, event) => {
    setFormError(undefined);
    try {
      await api<TransactionDto>(
        transfer ? `/transactions/transfers/${transfer.groupId}` : '/transactions/transfers',
        { method: transfer ? 'PUT' : 'POST', body: values },
      );
      await invalidate();
      notify(transaction ? 'Transferência atualizada' : 'Transferência lançada');
      if (wantsAnother(event)) {
        reset({ ...values, amountCents: 0, notes: null });
        setShowNotes(false);
        setFocus('amountCents');
      } else {
        onDone();
      }
    } catch (error) {
      handleError(error, setError, setFormError);
    }
  });

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />

      <Controller
        control={control}
        name="amountCents"
        render={({ field }) => (
          <Field label="Valor" error={errors.amountCents?.message}>
            <CurrencyInput
              ref={field.ref}
              size="lg"
              value={field.value}
              onChange={field.onChange}
              error={errors.amountCents?.message}
              aria-label="Valor"
              autoFocus={!transaction}
            />
          </Field>
        )}
      />

      <div className="relative grid gap-3 rounded-[14px] border border-line bg-canvas p-4">
        <Field label="De" error={errors.fromAccountId?.message}>
          <Select error={errors.fromAccountId?.message} {...register('fromAccountId')}>
            <option value="" disabled>
              {sources.length ? 'Escolha' : 'Cadastre uma conta corrente ou carteira'}
            </option>
            <AccountOptions accounts={sources} />
          </Select>
        </Field>
        <button
          type="button"
          onClick={swap}
          disabled={!toAccountId || Boolean(toCard)}
          className="absolute top-1/2 right-6 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-surface text-slate shadow-sm transition-colors hover:text-graphite disabled:opacity-0"
          aria-label="Inverter origem e destino"
          title="Inverter"
        >
          <ArrowUpDown size={16} />
        </button>
        <Field
          label="Para"
          error={errors.toAccountId?.message}
          hint={
            toCard ? 'Pagamento de cartão: abate do total em aberto quando realizado.' : undefined
          }
        >
          <Select error={errors.toAccountId?.message} {...register('toAccountId')}>
            <option value="" disabled>
              Escolha
            </option>
            <AccountOptions accounts={targets} />
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Descrição"
          autoComplete="off"
          maxLength={200}
          error={errors.description?.message}
          {...register('description')}
        />
        <TextField
          label="Data"
          type="date"
          error={errors.date?.message}
          {...register('date', {
            onChange: (event: { target: { value: string } }) => {
              if (event.target.value > today) setValue('status', 'PLANNED');
            },
          })}
        />
      </div>

      <div>
        <Switch
          checked={status === 'PAID'}
          onChange={(checked) => setValue('status', checked ? 'PAID' : 'PLANNED')}
          disabled={isFuture}
          label="Já foi feita"
          description={
            isFuture
              ? 'Datas futuras ficam como previstas e entram na projeção.'
              : 'Desligado, fica como prevista e não mexe nos saldos.'
          }
        />
        {errors.status?.message ? (
          <p className="mt-1.5 text-[13px] text-negative">{errors.status.message}</p>
        ) : null}
      </div>

      <NotesField
        open={showNotes}
        onOpen={() => setShowNotes(true)}
        error={errors.notes?.message}
        registration={register('notes')}
      />
    </form>
  );
}

function NotesField({
  open,
  onOpen,
  error,
  registration,
}: {
  open: boolean;
  onOpen: () => void;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  if (!open) {
    return (
      <button type="button" onClick={onOpen} className="link-ember self-start text-sm">
        + Adicionar observação
      </button>
    );
  }
  return (
    <Field label="Observação" error={error} htmlFor="transaction-notes">
      <textarea
        id="transaction-notes"
        rows={3}
        maxLength={1000}
        autoFocus
        className="w-full rounded-[10px] border border-line-strong bg-surface px-4 py-3 text-[15px] placeholder:text-faint hover:border-faint focus:border-ember focus:ring-4 focus:ring-ember-soft focus:outline-none"
        placeholder="Detalhes que ajudam a lembrar depois"
        {...registration}
      />
    </Field>
  );
}
