import {
  recurrenceInputSchema,
  todayIso,
  type CategoryDto,
  type RecurrenceDto,
  type RecurrenceInput,
  type RecurrenceInputParsed,
} from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownLeft, ArrowUpRight, CalendarClock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button, FormAlert, TextField } from '@/components/form';
import { CurrencyInput, Field, Select } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { AccountOptions } from '@/features/accounts/AccountOptions';
import { selectableAccounts, useAccounts } from '@/features/accounts/account-meta';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { CategoryFormModal } from '@/features/categories/CategoryFormModal';
import { useCategories } from '@/features/categories/use-categories';
import { useInvalidateMoney } from '@/features/transactions/transaction-api';
import { api, ApiError } from '@/lib/api';
import { describeFrequency, formatShortDate } from '@/lib/dates';

const FORM_ID = 'recurrence-form';

const FREQUENCIES = [
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'YEARLY', label: 'Anual' },
] as const;

/** Cadastro e edição de recorrência. Montado só quando aberto. */
export function RecurrenceFormModal({
  recurrence,
  preset,
  onClose,
  onEnd,
}: {
  recurrence?: RecurrenceDto;
  /** Atalhos do estado vazio ("Salário", "Aluguel"...). */
  preset?: { type: 'INCOME' | 'EXPENSE'; description: string };
  onClose: () => void;
  onEnd?: (recurrence: RecurrenceDto) => void;
}) {
  const notify = useToast();
  const invalidate = useInvalidateMoney();
  const { data: activeAccounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const [formError, setFormError] = useState<string>();
  const [creatingCategory, setCreatingCategory] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecurrenceInput, unknown, RecurrenceInputParsed>({
    resolver: zodResolver(recurrenceInputSchema),
    defaultValues: recurrence
      ? {
          type: recurrence.type,
          accountId: recurrence.account.id,
          categoryId: recurrence.category?.id ?? '',
          amountCents: recurrence.amountCents,
          description: recurrence.description,
          frequency: recurrence.frequency,
          startDate: recurrence.startDate,
          endDate: recurrence.endDate,
        }
      : {
          type: preset?.type ?? 'EXPENSE',
          accountId: '',
          categoryId: '',
          amountCents: 0,
          description: preset?.description ?? '',
          frequency: 'MONTHLY',
          startDate: todayIso(),
          endDate: null,
        },
  });

  const [type, frequency, startDate, endDate] = useWatch({
    control,
    name: ['type', 'frequency', 'startDate', 'endDate'],
  });
  const accounts = useMemo(
    () => selectableAccounts(activeAccounts, [recurrence?.account]),
    [activeAccounts, recurrence?.account],
  );
  const options = categories.filter((category: CategoryDto) => category.type === type);

  useEffect(() => {
    if (!getValues('accountId') && accounts[0]) setValue('accountId', accounts[0].id);
  }, [accounts, getValues, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await api<RecurrenceDto>(recurrence ? `/recurrences/${recurrence.id}` : '/recurrences', {
        method: recurrence ? 'PUT' : 'POST',
        body: values,
      });
      await invalidate();
      notify(
        recurrence
          ? 'Recorrência atualizada daqui para frente'
          : 'Recorrência criada: os próximos 12 meses já estão previstos',
      );
      onClose();
    } catch (error) {
      const message = applyServerErrors(error, setError);
      if (!(error instanceof ApiError) || Object.keys(error.fields).length === 0) {
        setFormError(message);
      }
    }
  });

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={recurrence ? 'Editar recorrência' : 'Nova recorrência'}
        description={
          recurrence ? undefined : 'Salário, aluguel, assinaturas: o que se repete com data certa.'
        }
        footer={
          <>
            {recurrence && onEnd && recurrence.active ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto !text-negative hover:!bg-negative-soft"
                onClick={() => onEnd(recurrence)}
              >
                Encerrar
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form={FORM_ID} loading={isSubmitting}>
              {recurrence ? 'Salvar' : 'Criar recorrência'}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <FormAlert message={formError} />

          <div role="tablist" aria-label="Tipo" className="flex gap-1 rounded-[12px] bg-sunken p-1">
            {(['EXPENSE', 'INCOME'] as const).map((value) => {
              const selected = type === value;
              const Icon = value === 'INCOME' ? ArrowDownLeft : ArrowUpRight;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setValue('type', value);
                    setValue('categoryId', '');
                  }}
                  className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[9px] text-sm font-medium transition-colors ${
                    selected
                      ? `bg-surface shadow-sm ${value === 'INCOME' ? 'text-positive' : 'text-negative'}`
                      : 'text-slate hover:text-graphite'
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {value === 'INCOME' ? 'Entrada' : 'Saída'}
                </button>
              );
            })}
          </div>

          <Controller
            control={control}
            name="amountCents"
            render={({ field }) => (
              <Field label="Valor de cada vez" error={errors.amountCents?.message}>
                <CurrencyInput
                  ref={field.ref}
                  size="lg"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.amountCents?.message}
                  aria-label="Valor"
                  autoFocus={!recurrence}
                />
              </Field>
            )}
          />

          <TextField
            label="Descrição"
            placeholder={type === 'INCOME' ? 'Ex.: Salário' : 'Ex.: Aluguel, Internet'}
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
              </Select>
            </Field>
            <Field
              label={type === 'INCOME' ? 'Entra em' : 'Sai de'}
              error={errors.accountId?.message}
            >
              <Select error={errors.accountId?.message} {...register('accountId')}>
                <option value="" disabled>
                  Escolha
                </option>
                <AccountOptions accounts={accounts} />
              </Select>
            </Field>
          </div>

          <div className="space-y-4 rounded-[14px] border border-line bg-canvas p-4">
            <Controller
              control={control}
              name="frequency"
              render={({ field }) => (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">Frequência</legend>
                  <div className="flex h-12 gap-1 rounded-[10px] border border-line-strong bg-surface p-1">
                    {FREQUENCIES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={field.value === option.value}
                        onClick={() => field.onChange(option.value)}
                        className={`flex-1 rounded-[7px] text-sm transition-colors ${
                          field.value === option.value
                            ? 'bg-ember-soft font-medium text-ember-deep'
                            : 'text-slate hover:text-graphite'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Começa em"
                type="date"
                error={errors.startDate?.message}
                {...register('startDate')}
              />
              <TextField
                label="Termina em (opcional)"
                type="date"
                min={startDate}
                error={errors.endDate?.message}
                {...register('endDate', { setValueAs: (value) => value || null })}
              />
            </div>
            <p className="flex items-start gap-3 text-sm text-steel">
              <CalendarClock
                size={18}
                className="mt-0.5 shrink-0 text-ember-deep"
                aria-hidden="true"
              />
              <span>
                {frequency && /^\d{4}-\d{2}-\d{2}$/.test(startDate ?? '') ? (
                  <strong className="text-graphite">
                    {describeFrequency(frequency, startDate!)}
                  </strong>
                ) : null}
                {endDate ? `, até ${formatShortDate(endDate)}` : ', sem data para acabar'}.{' '}
                {recurrence
                  ? 'As mudanças valem para os lançamentos previstos de hoje em diante; os que já aconteceram ou foram editados à mão ficam como estão.'
                  : 'Os lançamentos nascem previstos e entram na projeção.'}
              </span>
            </p>
          </div>
        </form>
      </Modal>
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
