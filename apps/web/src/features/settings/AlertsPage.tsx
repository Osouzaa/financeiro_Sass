import { alertPreferencesSchema, type AlertPreferences, type ProfileDto } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, PiggyBank, TrendingDown, type LucideIcon } from 'lucide-react';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/form';
import { NumberInput, Switch } from '@/components/inputs';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { SettingsSection } from './SettingsLayout';

export function AlertsPage() {
  const { data } = useQuery({ queryKey: ['profile'], queryFn: () => api<ProfileDto>('/me') });
  if (!data) return <p className="text-slate">Carregando…</p>;
  return <AlertsForm initial={data.alerts} />;
}

function AlertsForm({ initial }: { initial: AlertPreferences }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AlertPreferences>({
    resolver: zodResolver(alertPreferencesSchema),
    defaultValues: initial,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const profile = await api<ProfileDto>('/me/alerts', { method: 'PUT', body: values });
      queryClient.setQueryData(['profile'], profile);
      reset(profile.alerts);
      notify('Preferências de alertas salvas');
    } catch (error) {
      notify((error as Error).message, 'error');
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title="Avisos no painel"
        description="Escolha o que merece sua atenção. Os avisos aparecem no painel conforme as contas, faturas e orçamentos forem cadastrados."
      >
        <div className="divide-y divide-line rounded-[12px] border border-line">
          <AlertRow
            icon={CalendarClock}
            control={control}
            name="dueSoon"
            label="Contas e faturas a vencer"
            description="Avisa antes do vencimento de contas recorrentes e faturas de cartão."
          >
            <label className="flex items-center gap-3 text-sm text-steel">
              Avisar com
              <NumberInput
                min={1}
                max={15}
                className="!h-10 !w-20 text-center"
                error={errors.dueDays?.message}
                {...register('dueDays', { valueAsNumber: true })}
              />
              dias de antecedência
            </label>
            {errors.dueDays ? (
              <p className="mt-1 text-[13px] text-negative">{errors.dueDays.message}</p>
            ) : null}
          </AlertRow>

          <AlertRow
            icon={PiggyBank}
            control={control}
            name="budget"
            label="Orçamento perto do limite"
            description="Avisa quando os gastos de uma categoria chegam perto do limite do mês."
          >
            <label className="flex items-center gap-3 text-sm text-steel">
              Avisar ao atingir
              <NumberInput
                min={50}
                max={100}
                step={5}
                className="!h-10 !w-20 text-center"
                error={errors.budgetPercent?.message}
                {...register('budgetPercent', { valueAsNumber: true })}
              />
              % do limite
            </label>
            {errors.budgetPercent ? (
              <p className="mt-1 text-[13px] text-negative">{errors.budgetPercent.message}</p>
            ) : null}
          </AlertRow>

          <AlertRow
            icon={TrendingDown}
            control={control}
            name="negativeBalance"
            label="Saldo projetado negativo"
            description="Avisa quando a projeção indicar que alguma conta vai ficar no vermelho."
          />
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Salvar preferências
          </Button>
        </div>
      </SettingsSection>
    </form>
  );
}

function AlertRow({
  icon: Icon,
  control,
  name,
  label,
  description,
  children,
}: {
  icon: LucideIcon;
  control: Control<AlertPreferences>;
  name: 'dueSoon' | 'budget' | 'negativeBalance';
  label: string;
  description: string;
  children?: React.ReactNode;
}) {
  const enabled = useWatch({ control, name });
  return (
    <div className="flex gap-4 px-4 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-ember-soft text-ember-deep">
        <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Switch
              checked={field.value}
              onChange={field.onChange}
              label={label}
              description={description}
            />
          )}
        />
        {children && enabled ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  );
}
