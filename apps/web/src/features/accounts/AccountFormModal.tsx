import {
  accountInputSchema,
  todayIso,
  type AccountDto,
  type AccountInput,
  type AccountInputParsed,
} from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button, FormAlert, TextField } from '@/components/form';
import { CurrencyInput, Field, NumberInput, Select } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { api, ApiError } from '@/lib/api';
import { ACCOUNT_COLORS, ACCOUNT_TYPES, useAccounts } from './account-meta';

function defaultsFor(account?: AccountDto): AccountInput {
  if (!account) {
    return {
      name: '',
      type: 'CHECKING',
      color: ACCOUNT_COLORS[0],
      initialBalanceCents: 0,
      initialBalanceDate: todayIso(),
      closingDay: null,
      dueDay: null,
      creditLimitCents: null,
      paymentAccountId: null,
    };
  }
  return {
    name: account.name,
    type: account.type,
    color: account.color ?? ACCOUNT_COLORS[0],
    initialBalanceCents: account.initialBalanceCents,
    initialBalanceDate: account.initialBalanceDate,
    closingDay: account.closingDay,
    dueDay: account.dueDay,
    creditLimitCents: account.creditLimitCents,
    paymentAccountId: account.paymentAccountId,
  };
}

/** Modal de cadastro/edição. Montado só quando aberto, para sempre começar limpo. */
export function AccountFormModal({
  account,
  onClose,
}: {
  account?: AccountDto;
  onClose: () => void;
}) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const [formError, setFormError] = useState<string>();
  const editing = Boolean(account);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountInput, unknown, AccountInputParsed>({
    resolver: zodResolver(accountInputSchema),
    defaultValues: defaultsFor(account),
  });

  const type = useWatch({ control, name: 'type' });
  const isCard = type === 'CREDIT_CARD';
  const payers = accounts.filter((a) => a.type !== 'CREDIT_CARD' && a.id !== account?.id);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await api<AccountDto>(editing ? `/accounts/${account!.id}` : '/accounts', {
        method: editing ? 'PUT' : 'POST',
        body: values,
      });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      notify(
        editing ? 'Conta atualizada' : `${isCard ? 'Cartão' : 'Conta'} cadastrado com sucesso`,
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
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar conta' : 'Nova conta'}
      description={
        editing ? undefined : 'Cadastre onde seu dinheiro está ou o cartão que você usa.'
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="account-form" loading={isSubmitting}>
            {editing ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={formError} />

        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Tipo</legend>
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_TYPES.map(({ type: value, label, description, icon: Icon }) => {
                  const selected = field.value === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(value)}
                      aria-pressed={selected}
                      className={`flex flex-col items-start gap-2 rounded-[12px] border p-3 text-left transition-colors ${
                        selected
                          ? 'border-ember bg-ember-soft/60 ring-1 ring-ember'
                          : 'border-line-strong hover:bg-sunken'
                      }`}
                    >
                      <Icon
                        size={20}
                        strokeWidth={1.75}
                        className={selected ? 'text-ember-deep' : 'text-slate'}
                        aria-hidden="true"
                      />
                      <span>
                        <span className="block text-sm font-medium leading-tight">{label}</span>
                        <span className="mt-0.5 hidden text-[12px] text-slate sm:block">
                          {description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        />

        <TextField
          label="Nome"
          placeholder={isCard ? 'Ex.: Nubank, Itaú Platinum' : 'Ex.: Conta Itaú, Carteira'}
          error={errors.name?.message}
          {...register('name')}
        />

        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Cor</legend>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => field.onChange(color)}
                    className="grid size-9 place-items-center rounded-full ring-offset-2 transition-shadow aria-pressed:ring-2 aria-pressed:ring-graphite"
                    style={{ background: color }}
                    aria-pressed={field.value === color}
                    aria-label={`Cor ${color}`}
                  >
                    {field.value === color ? <Check size={16} className="text-white" /> : null}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        />

        {isCard ? (
          <>
            <Controller
              control={control}
              name="creditLimitCents"
              render={({ field }) => (
                <Field label="Limite total" error={errors.creditLimitCents?.message}>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.creditLimitCents?.message}
                    aria-label="Limite total"
                  />
                </Field>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Dia do fechamento"
                error={errors.closingDay?.message}
                hint="Compras a partir deste dia vão para a próxima fatura."
              >
                <NumberInput
                  min={1}
                  max={31}
                  placeholder="25"
                  error={errors.closingDay?.message}
                  {...register('closingDay', {
                    setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                  })}
                />
              </Field>
              <Field label="Dia do vencimento" error={errors.dueDay?.message}>
                <NumberInput
                  min={1}
                  max={31}
                  placeholder="5"
                  error={errors.dueDay?.message}
                  {...register('dueDay', {
                    setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                  })}
                />
              </Field>
            </div>
            <Field
              label="Pagar a fatura com"
              error={errors.paymentAccountId?.message}
              hint={
                payers.length === 0
                  ? 'Cadastre uma conta corrente para indicar de onde sai o pagamento.'
                  : 'Usada na projeção: a fatura sai desta conta no vencimento.'
              }
            >
              <Select
                error={errors.paymentAccountId?.message}
                {...register('paymentAccountId', { setValueAs: (v) => v || null })}
              >
                <option value="">Escolher depois</option>
                {payers.map((payer) => (
                  <option key={payer.id} value={payer.id}>
                    {payer.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="initialBalanceCents"
              render={({ field }) => (
                <Field
                  label="Saldo inicial"
                  error={errors.initialBalanceCents?.message}
                  hint="Use a tecla − para saldo negativo."
                >
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    allowNegative
                    error={errors.initialBalanceCents?.message}
                    aria-label="Saldo inicial"
                  />
                </Field>
              )}
            />
            <TextField
              label="Saldo em"
              type="date"
              error={errors.initialBalanceDate?.message}
              hint="Lançamentos a partir desta data mexem no saldo."
              {...register('initialBalanceDate')}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
