import {
  formatBRL,
  invoicePaymentSchema,
  isValidIsoDate,
  todayIso,
  type InvoiceDto,
  type InvoicePaymentInput,
  type InvoicePaymentInputParsed,
  type TransactionDto,
} from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button, FormAlert, TextField } from '@/components/form';
import { CurrencyInput, Field, Select, Switch } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { useAccounts } from '@/features/accounts/account-meta';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { useInvalidateMoney } from '@/features/transactions/transaction-api';
import { api, ApiError } from '@/lib/api';
import { formatMonthTitle, formatShortDate } from '@/lib/dates';

/** Pagamento total ou parcial. Vira uma transferência da conta escolhida para o cartão. */
export function PayInvoiceModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceDto;
  onClose: () => void;
}) {
  const notify = useToast();
  const invalidate = useInvalidateMoney();
  const { data: accounts = [] } = useAccounts();
  const [formError, setFormError] = useState<string>();
  const today = todayIso();
  const payers = useMemo(() => accounts.filter((a) => a.type !== 'CREDIT_CARD'), [accounts]);
  const remaining = invoice.remainingCents - invoice.scheduledCents;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InvoicePaymentInput, unknown, InvoicePaymentInputParsed>({
    resolver: zodResolver(invoicePaymentSchema),
    defaultValues: {
      fromAccountId: invoice.paymentAccountId ?? '',
      amountCents: Math.max(0, remaining),
      date: today,
      status: 'PAID',
    },
  });

  // Sem conta padrão no cartão, sugere a primeira conta corrente assim que a lista carregar
  useEffect(() => {
    if (!getValues('fromAccountId') && payers[0]) setValue('fromAccountId', payers[0].id);
  }, [payers, getValues, setValue]);

  const [date, status, amount, fromAccountId] = useWatch({
    control,
    name: ['date', 'status', 'amountCents', 'fromAccountId'],
  });
  const isFuture = isValidIsoDate(date) && date > today;
  const payer = accounts.find((a) => a.id === fromAccountId);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await api<TransactionDto>(`/invoices/${invoice.id}/pay`, { method: 'POST', body: values });
      await invalidate();
      notify(values.status === 'PAID' ? 'Pagamento registrado' : 'Pagamento agendado');
      onClose();
    } catch (error) {
      const message = applyServerErrors(error, setError);
      if (!(error instanceof ApiError) || Object.keys(error.fields).length === 0) {
        setFormError(message);
      }
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pagar fatura de ${formatMonthTitle(invoice.referenceMonth).split(' ')[0]}`}
      description={`${invoice.account.name} · vence em ${formatShortDate(invoice.dueDate)}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="pay-invoice-form" loading={isSubmitting}>
            {isFuture || status === 'PLANNED' ? 'Agendar pagamento' : 'Registrar pagamento'}
          </Button>
        </>
      }
    >
      <form id="pay-invoice-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={formError} />

        <Controller
          control={control}
          name="amountCents"
          render={({ field }) => (
            <Field
              label="Valor"
              error={errors.amountCents?.message}
              hint={
                amount > remaining && remaining > 0
                  ? 'Acima do que falta: a diferença fica como crédito no cartão.'
                  : undefined
              }
            >
              <CurrencyInput
                ref={field.ref}
                size="lg"
                value={field.value}
                onChange={field.onChange}
                error={errors.amountCents?.message}
                aria-label="Valor"
              />
            </Field>
          )}
        />

        {remaining > 0 ? (
          <div className="-mt-2 flex flex-wrap gap-2">
            <QuickAmount
              label={`Valor restante · ${formatBRL(remaining)}`}
              active={amount === remaining}
              onClick={() => setValue('amountCents', remaining, { shouldValidate: true })}
            />
            {invoice.totalCents !== remaining && invoice.totalCents > 0 ? (
              <QuickAmount
                label={`Total · ${formatBRL(invoice.totalCents)}`}
                active={amount === invoice.totalCents}
                onClick={() =>
                  setValue('amountCents', invoice.totalCents, { shouldValidate: true })
                }
              />
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pagar com" error={errors.fromAccountId?.message}>
            <Select error={errors.fromAccountId?.message} {...register('fromAccountId')}>
              <option value="" disabled>
                {payers.length ? 'Escolha' : 'Cadastre uma conta corrente'}
              </option>
              {payers.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
          <TextField
            label="Data do pagamento"
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
            label="Já paguei"
            description={
              isFuture
                ? 'Data futura: fica agendado e entra na projeção.'
                : `Ligado, sai de ${payer?.name ?? 'a conta'} agora e abate do cartão.`
            }
          />
          {errors.status?.message ? (
            <p className="mt-1.5 text-[13px] text-negative">{errors.status.message}</p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

function QuickAmount({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tabular rounded-full border px-3 py-1 text-[13px] transition-colors ${
        active
          ? 'border-ember bg-ember-soft text-ember-deep'
          : 'border-line-strong text-steel hover:bg-sunken'
      }`}
    >
      {label}
    </button>
  );
}
