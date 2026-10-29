import {
  FREE_PLAN_CODE,
  planInputSchema,
  type PlanDto,
  type PlanInput,
  type PlanInputParsed,
  type PlanLimits,
} from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, EyeOff, Pencil, Plus, Star } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button, FormAlert, TextField } from '@/components/form';
import { CurrencyInput, Field, NumberInput, Select, Switch } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { formatPlanPrice } from '@/features/plans/plan-api';
import { api, ApiError } from '@/lib/api';
import { useAdminPlans, useInvalidateAdmin } from './admin-api';

type Counted = 'maxAccounts' | 'maxCards' | 'maxRecurrences' | 'maxBudgets';

const LIMITS: { key: Counted; label: string }[] = [
  { key: 'maxAccounts', label: 'Contas e carteiras' },
  { key: 'maxCards', label: 'Cartões de crédito' },
  { key: 'maxRecurrences', label: 'Recorrências ativas' },
  { key: 'maxBudgets', label: 'Limites de orçamento por mês' },
];

const limitText = (value: number | null) => (value === null ? 'Ilimitado' : String(value));

export function AdminPlansPage() {
  const { data: plans = [], isPending } = useAdminPlans();
  const [editing, setEditing] = useState<PlanDto | 'new' | null>(null);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[64ch] text-sm text-slate">
          Preço, limites e o que aparece na vitrine. Mudanças valem na hora para quem já está no
          plano. O Grátis é o plano de quem não tem assinatura: ele sempre existe e fica ativo.
        </p>
        <Button type="button" onClick={() => setEditing('new')}>
          <Plus size={18} aria-hidden="true" /> Novo plano
        </Button>
      </div>

      {isPending ? (
        <div className="card h-[260px] animate-pulse bg-sunken/40" aria-hidden="true" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className={`card flex flex-col p-5 ${plan.isActive ? '' : 'opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-display text-lg font-semibold">
                    {plan.name}
                    {plan.highlighted ? (
                      <Star size={15} className="fill-ember text-ember" aria-label="Destaque" />
                    ) : null}
                  </p>
                  <p className="text-[12px] text-faint">{plan.code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(plan)}
                  className="grid size-8 place-items-center rounded-[8px] text-slate hover:bg-sunken hover:text-graphite"
                  aria-label={`Editar ${plan.name}`}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <p className="tabular mt-3 font-display text-2xl font-semibold">
                {formatPlanPrice(plan)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                {!plan.isPublic ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-steel">
                    <EyeOff size={12} aria-hidden="true" /> Fora da vitrine
                  </span>
                ) : (
                  <span className="rounded-full bg-positive-soft px-2 py-0.5 text-positive">
                    Na vitrine
                  </span>
                )}
                {!plan.isActive ? (
                  <span className="rounded-full bg-negative-soft px-2 py-0.5 text-negative">
                    Desativado
                  </span>
                ) : null}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[13px]">
                {LIMITS.map(({ key, label }) => (
                  <div key={key} className="contents">
                    <dt className="text-slate">{label}</dt>
                    <dd className="tabular text-right">{limitText(plan.limits[key])}</dd>
                  </div>
                ))}
                <dt className="text-slate">Projeção</dt>
                <dd className="tabular text-right">{plan.limits.projectionDays} dias</dd>
                <dt className="text-slate">WhatsApp</dt>
                <dd className="text-right">{plan.limits.whatsapp ? 'Sim' : 'Não'}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <PlanFormModal
          plan={editing === 'new' ? undefined : editing}
          nextSort={(plans.at(-1)?.sortOrder ?? 0) + 1}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function toInput(plan: PlanDto | undefined, nextSort: number): PlanInput {
  if (!plan) {
    return {
      code: '',
      name: '',
      description: '',
      priceCents: 0,
      interval: 'MONTH',
      isPublic: false,
      isActive: true,
      highlighted: false,
      sortOrder: nextSort,
      features: [],
      limits: {
        maxAccounts: null,
        maxCards: null,
        maxRecurrences: null,
        maxBudgets: null,
        projectionDays: 365,
        whatsapp: false,
      },
    };
  }
  const { id: _id, ...rest } = plan;
  return rest;
}

function PlanFormModal({
  plan,
  nextSort,
  onClose,
}: {
  plan?: PlanDto;
  nextSort: number;
  onClose: () => void;
}) {
  const invalidate = useInvalidateAdmin();
  const notify = useToast();
  const [formError, setFormError] = useState<string>();
  const isFree = plan?.code === FREE_PLAN_CODE;
  const initial = toInput(plan, nextSort);
  const [featuresText, setFeaturesText] = useState((initial.features ?? []).join('\n'));
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlanInput, unknown, PlanInputParsed>({
    resolver: zodResolver(planInputSchema),
    defaultValues: initial,
  });
  const limits = useWatch({ control, name: 'limits' }) as PlanLimits;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await api<PlanDto>(plan ? `/admin/plans/${plan.id}` : '/admin/plans', {
        method: plan ? 'PUT' : 'POST',
        body: values,
      });
      await invalidate();
      notify(plan ? `Plano ${values.name} atualizado` : `Plano ${values.name} criado`);
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
      title={plan ? `Editar ${plan.name}` : 'Novo plano'}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="plan-form" loading={isSubmitting}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        id="plan-form"
        onSubmit={(event) => {
          // Uma linha por destaque na vitrine
          setValue(
            'features',
            featuresText
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          );
          void onSubmit(event);
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <FormAlert message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nome"
            maxLength={40}
            error={errors.name?.message}
            {...register('name')}
          />
          <TextField
            label="Código"
            maxLength={30}
            disabled={isFree}
            hint={isFree ? 'O código do Grátis não muda.' : 'Ex.: pro, pro-anual'}
            error={errors.code?.message}
            {...register('code')}
          />
        </div>
        <TextField
          label="Descrição"
          maxLength={200}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Controller
            control={control}
            name="priceCents"
            render={({ field }) => (
              <Field label="Preço" error={errors.priceCents?.message}>
                <CurrencyInput value={field.value} onChange={field.onChange} aria-label="Preço" />
              </Field>
            )}
          />
          <Field label="Cobrança">
            <Select {...register('interval')}>
              <option value="MONTH">Mensal</option>
              <option value="YEAR">Anual</option>
            </Select>
          </Field>
        </div>

        <fieldset className="rounded-[14px] border border-line bg-canvas p-4">
          <legend className="px-1 text-sm font-medium">Limites</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {LIMITS.map(({ key, label }) => {
              const unlimited = limits?.[key] === null;
              return (
                <div key={key} className="rounded-[10px] bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{label}</span>
                    <label className="flex items-center gap-1.5 text-[12px] text-slate">
                      <input
                        type="checkbox"
                        checked={unlimited}
                        onChange={(event) =>
                          setValue(`limits.${key}`, event.target.checked ? null : 1, {
                            shouldDirty: true,
                          })
                        }
                        className="accent-[var(--color-ember)]"
                      />
                      Ilimitado
                    </label>
                  </div>
                  {!unlimited ? (
                    <NumberInput
                      min={0}
                      className="mt-2 !h-10"
                      error={errors.limits?.[key]?.message}
                      {...register(`limits.${key}`, { valueAsNumber: true })}
                    />
                  ) : null}
                </div>
              );
            })}
            <div className="rounded-[10px] bg-surface p-3">
              <span className="text-sm">Dias de projeção</span>
              <NumberInput
                min={7}
                max={365}
                className="mt-2 !h-10"
                error={errors.limits?.projectionDays?.message}
                {...register('limits.projectionDays', { valueAsNumber: true })}
              />
            </div>
            <div className="rounded-[10px] bg-surface p-3">
              <Controller
                control={control}
                name="limits.whatsapp"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onChange={field.onChange}
                    label="Assistente no WhatsApp"
                  />
                )}
              />
            </div>
          </div>
        </fieldset>

        <Field
          label="Destaques na vitrine (um por linha)"
          error={errors.features?.message}
          htmlFor="plan-features"
        >
          <textarea
            id="plan-features"
            rows={4}
            value={featuresText}
            onChange={(event) => setFeaturesText(event.target.value)}
            className="w-full rounded-[10px] border border-line-strong bg-surface px-4 py-3 text-[15px] hover:border-faint focus:border-ember focus:ring-4 focus:ring-ember-soft focus:outline-none"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {(['isPublic', 'isActive', 'highlighted'] as const).map((name) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onChange={field.onChange}
                  label={
                    { isPublic: 'Na vitrine', isActive: 'Ativo', highlighted: 'Destaque' }[name]
                  }
                  description={
                    {
                      isPublic: 'Aparece na página de planos.',
                      isActive: isFree
                        ? 'O Grátis fica sempre ativo.'
                        : 'Pode receber novas assinaturas.',
                      highlighted: 'Marcado como "mais escolhido".',
                    }[name]
                  }
                  disabled={name === 'isActive' && isFree}
                />
              )}
            />
          ))}
          <TextField
            label="Ordem na vitrine"
            type="number"
            min={0}
            error={errors.sortOrder?.message}
            {...register('sortOrder', { valueAsNumber: true })}
          />
        </div>
        {errors.limits ? (
          <p className="flex items-center gap-1.5 text-[13px] text-negative">
            <Check size={14} aria-hidden="true" /> Confira os limites.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
