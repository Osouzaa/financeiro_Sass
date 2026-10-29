import {
  FREE_PLAN_CODE,
  planInputSchema,
  type PlanDto,
  type PlanInput,
  type PlanInputParsed,
} from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button, FormAlert, TextField } from '@/components/form';
import { CurrencyInput, Field, NumberInput, Select, Switch } from '@/components/inputs';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { formatPlanPrice } from '@/features/plans/plan-api';
import { api, ApiError } from '@/lib/api';
import { useAdminMetrics, useAdminPlans, useInvalidateAdmin } from './admin-api';

type Counted = 'maxAccounts' | 'maxCards' | 'maxRecurrences' | 'maxBudgets';

const LIMITS: { key: Counted; label: string; short: string }[] = [
  { key: 'maxAccounts', label: 'Contas e carteiras', short: 'contas' },
  { key: 'maxCards', label: 'Cartões de crédito', short: 'cartões' },
  { key: 'maxRecurrences', label: 'Recorrências ativas', short: 'recorrências' },
  { key: 'maxBudgets', label: 'Categorias com orçamento', short: 'orçamentos' },
];

export function AdminPlansPage() {
  const { data: plans = [], isPending } = useAdminPlans();
  const { data: metrics } = useAdminMetrics();
  const [editing, setEditing] = useState<PlanDto | 'new' | null>(null);
  const subscribers = new Map(metrics?.byPlan.map((row) => [row.planId, row.users]) ?? []);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-[62ch] text-[15px] leading-[1.6] text-steel">
          Preço, teste grátis, limites e o que aparece na vitrine. Mudanças valem na hora para quem
          já está no plano. O Grátis é o plano de quem não tem assinatura, por isso fica sempre
          ativo.
        </p>
        <Button type="button" onClick={() => setEditing('new')}>
          <Plus size={18} aria-hidden="true" /> Novo plano
        </Button>
      </div>

      {isPending ? (
        <div className="card h-[260px] animate-pulse bg-sunken/40" aria-hidden="true" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-slate">
                <th className="px-5 py-3 font-medium">Plano</th>
                <th className="px-5 py-3 font-medium">Preço</th>
                <th className="px-5 py-3 font-medium">Teste</th>
                <th className="px-5 py-3 font-medium">Limites</th>
                <th className="px-5 py-3 font-medium">Situação</th>
                <th className="px-5 py-3 text-right font-medium">Contas</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plans.map((plan) => (
                <tr key={plan.id} className={plan.isActive ? '' : 'text-slate'}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-graphite">{plan.name}</p>
                    <p className="text-[13px] text-slate">{plan.code}</p>
                  </td>
                  <td className="tabular px-5 py-4">{formatPlanPrice(plan)}</td>
                  <td className="tabular px-5 py-4">
                    {plan.trialDays ? `${plan.trialDays} dias` : '—'}
                  </td>
                  <td className="px-5 py-4 text-[13px] leading-[1.6] text-steel">
                    {LIMITS.map(({ key, short }) => `${plan.limits[key] ?? '∞'} ${short}`).join(
                      ', ',
                    )}
                    <br />
                    Projeção de {plan.limits.projectionDays} dias
                    {plan.limits.whatsapp ? ', WhatsApp' : ''}
                  </td>
                  <td className="px-5 py-4 text-[13px]">
                    <p className={plan.isActive ? 'text-positive' : 'text-negative'}>
                      {plan.isActive ? 'Ativo' : 'Desativado'}
                    </p>
                    <p className="text-slate">
                      {plan.isPublic ? 'Na vitrine' : 'Fora da vitrine'}
                      {plan.highlighted ? ', em destaque' : ''}
                    </p>
                  </td>
                  <td className="tabular px-5 py-4 text-right">{subscribers.get(plan.id) ?? 0}</td>
                  <td className="px-5 py-4 text-right">
                    <Button type="button" variant="secondary" onClick={() => setEditing(plan)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      trialDays: 0,
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

function Block({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className="font-semibold">{title}</h3>
      {text ? <p className="mt-1 text-sm text-slate">{text}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
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
  const watched = useWatch({ control }) as PlanInput;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await api<PlanDto>(plan ? `/admin/plans/${plan.id}` : '/admin/plans', {
        method: plan ? 'PUT' : 'POST',
        body: values,
      });
      await invalidate();
      notify(plan ? `Plano ${values.name} salvo` : `Plano ${values.name} criado`);
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
      size="lg"
      title={plan ? `Editar ${plan.name}` : 'Novo plano'}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="plan-form" loading={isSubmitting}>
            {plan ? 'Salvar plano' : 'Criar plano'}
          </Button>
        </>
      }
    >
      <form
        id="plan-form"
        onSubmit={(event) => {
          // Um destaque por linha
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
        className="grid gap-8 md:grid-cols-[minmax(0,1fr)_220px]"
      >
        <div className="flex flex-col gap-6">
          <FormAlert message={formError} />

          <Block title="Identificação">
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
                hint={
                  isFree ? 'O código do Grátis não muda.' : 'Minúsculas e hífen, ex.: pro-anual'
                }
                error={errors.code?.message}
                {...register('code')}
              />
            </div>
            <div className="mt-4">
              <TextField
                label="Descrição curta"
                maxLength={200}
                error={errors.description?.message}
                {...register('description')}
              />
            </div>
          </Block>

          <Block title="Preço e teste grátis">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px_150px]">
              <Controller
                control={control}
                name="priceCents"
                render={({ field }) => (
                  <Field label="Preço" error={errors.priceCents?.message}>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      aria-label="Preço"
                    />
                  </Field>
                )}
              />
              <Field label="Cobrança">
                <Select {...register('interval')}>
                  <option value="MONTH">Mensal</option>
                  <option value="YEAR">Anual</option>
                </Select>
              </Field>
              <Field
                label="Dias grátis"
                error={errors.trialDays?.message}
                hint="Uma vez por pessoa"
              >
                <NumberInput
                  min={0}
                  max={90}
                  error={errors.trialDays?.message}
                  {...register('trialDays', { valueAsNumber: true })}
                />
              </Field>
            </div>
          </Block>

          <Block title="Limites" text="Deixe ilimitado o que o plano não deve restringir.">
            <div className="divide-y divide-line rounded-[12px] border border-line">
              {LIMITS.map(({ key, label }) => {
                const unlimited = watched.limits?.[key] === null;
                return (
                  <div key={key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 text-[15px]">{label}</span>
                    <label className="flex items-center gap-2 text-sm text-steel">
                      <input
                        type="checkbox"
                        checked={unlimited}
                        onChange={(event) =>
                          setValue(`limits.${key}`, event.target.checked ? null : 1, {
                            shouldDirty: true,
                          })
                        }
                        className="size-4 accent-[var(--color-ember)]"
                      />
                      Ilimitado
                    </label>
                    {!unlimited ? (
                      <NumberInput
                        min={0}
                        aria-label={label}
                        className="!h-10 !w-24"
                        error={errors.limits?.[key]?.message}
                        {...register(`limits.${key}`, { valueAsNumber: true })}
                      />
                    ) : null}
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 text-[15px]">Dias de projeção de saldo</span>
                <NumberInput
                  min={7}
                  max={365}
                  aria-label="Dias de projeção"
                  className="!h-10 !w-24"
                  error={errors.limits?.projectionDays?.message}
                  {...register('limits.projectionDays', { valueAsNumber: true })}
                />
              </div>
              <div className="px-4 py-3">
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
            {errors.limits ? (
              <p className="mt-2 text-[13px] text-negative">Confira os limites.</p>
            ) : null}
          </Block>

          <Block
            title="Vitrine"
            text="Como o plano aparece na página de divulgação e em Configurações → Plano."
          >
            <div className="flex flex-col gap-4">
              {(['isPublic', 'highlighted', 'isActive'] as const).map((name) => (
                <Controller
                  key={name}
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onChange={field.onChange}
                      disabled={name === 'isActive' && isFree}
                      label={
                        {
                          isPublic: 'Mostrar na vitrine',
                          highlighted: 'Destacar',
                          isActive: 'Ativo',
                        }[name]
                      }
                      description={
                        {
                          isPublic: 'Aparece para visitantes e para quem vai trocar de plano.',
                          highlighted: 'Ganha a moldura escura na comparação.',
                          isActive: isFree
                            ? 'O Grátis fica sempre ativo.'
                            : 'Desativado, não recebe novas assinaturas; quem já assina continua.',
                        }[name]
                      }
                    />
                  )}
                />
              ))}
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                <Field
                  label="Destaques da vitrine (um por linha)"
                  error={errors.features?.message}
                  htmlFor="plan-features"
                >
                  <textarea
                    id="plan-features"
                    rows={5}
                    value={featuresText}
                    onChange={(event) => setFeaturesText(event.target.value)}
                    className="w-full rounded-[10px] border border-line-strong bg-surface px-4 py-3 text-[15px] leading-[1.5] hover:border-faint focus:border-ember focus:ring-4 focus:ring-ember-soft focus:outline-none"
                  />
                </Field>
                <TextField
                  label="Ordem"
                  type="number"
                  min={0}
                  hint="Menor aparece antes"
                  error={errors.sortOrder?.message}
                  {...register('sortOrder', { valueAsNumber: true })}
                />
              </div>
            </div>
          </Block>
        </div>

        {/* Prévia ao vivo, como aparece para o cliente */}
        <aside className="hidden md:block" aria-label="Prévia na vitrine">
          <div className="sticky top-0">
            <p className="mb-2 text-sm text-slate">Prévia</p>
            <PlanPreview input={watched} features={featuresText} />
          </div>
        </aside>
      </form>
    </Modal>
  );
}

function PlanPreview({ input, features }: { input: PlanInput; features: string }) {
  const priceCents = Number.isFinite(input.priceCents) ? input.priceCents : 0;
  const [price, period] = formatPlanPrice({
    priceCents,
    interval: input.interval ?? 'MONTH',
  }).split('/');
  const lines = features
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
  const featured = input.highlighted;
  return (
    <div
      className={`rounded-[14px] border p-4 ${
        featured ? 'border-graphite bg-graphite text-white' : 'border-line bg-surface'
      }`}
    >
      <p className="font-display text-[17px] font-semibold">{input.name || 'Nome do plano'}</p>
      <p className={`mt-1 text-[13px] leading-[1.5] ${featured ? 'text-white/70' : 'text-slate'}`}>
        {input.description || 'Descrição curta'}
      </p>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="tabular font-display text-[24px] leading-none font-semibold">{price}</span>
        {period ? (
          <span className={`text-[13px] ${featured ? 'text-white/60' : 'text-slate'}`}>
            por {period}
          </span>
        ) : null}
      </p>
      {priceCents > 0 && Number(input.trialDays) > 0 ? (
        <p
          className={`mt-1 text-[13px] font-medium ${featured ? 'text-white/85' : 'text-positive'}`}
        >
          {input.trialDays} dias grátis
        </p>
      ) : null}
      <ul className="mt-3 space-y-1.5 text-[13px]">
        {lines.map((line) => (
          <li key={line} className="flex gap-1.5">
            <Check
              size={14}
              className={`mt-0.5 shrink-0 ${featured ? 'text-ember' : 'text-positive'}`}
              aria-hidden="true"
            />
            {line}
          </li>
        ))}
      </ul>
      {!input.isPublic ? (
        <p className={`mt-3 text-[12px] ${featured ? 'text-white/60' : 'text-slate'}`}>
          Fora da vitrine: só o admin vê.
        </p>
      ) : null}
    </div>
  );
}
