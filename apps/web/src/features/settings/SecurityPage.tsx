import {
  changePasswordSchema,
  type ChangePasswordInput,
  type SessionDto,
} from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button, FormAlert, PasswordField } from '@/components/form';
import { useToast } from '@/components/toast';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { useAuth } from '@/features/auth/auth-context';
import { passwordStrength } from '@/features/auth/password-strength';
import { api, ApiError } from '@/lib/api';
import { describeDevice } from './device';
import { DataSection } from './DataSection';
import { SettingsSection } from './SettingsLayout';

export function SecurityPage() {
  return (
    <div className="space-y-4">
      <PasswordSection />
      <SessionsSection />
      <DataSection />
    </div>
  );
}

const STRENGTH_COLORS = ['bg-negative', 'bg-negative', 'bg-ember', 'bg-positive', 'bg-positive'];

function PasswordSection() {
  const { changePassword } = useAuth();
  const notify = useToast();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const newPassword = useWatch({ control, name: 'newPassword' }) ?? '';
  const strength = passwordStrength(newPassword);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await changePassword(values);
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
      notify('Senha alterada. Os outros dispositivos foram desconectados.');
    } catch (error) {
      const message = applyServerErrors(error, setError);
      if (!(error instanceof ApiError) || Object.keys(error.fields).length === 0) {
        setFormError(message);
      }
    }
  });

  return (
    <SettingsSection
      title="Senha"
      description="Ao trocar a senha, todos os outros dispositivos são desconectados por segurança."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={formError} />
        <PasswordField
          label="Senha atual"
          icon={Lock}
          placeholder="Digite sua senha atual"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordField
            label="Nova senha"
            icon={Lock}
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            hint={
              newPassword ? (
                <div className="flex items-center gap-3">
                  <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
                    {[1, 2, 3, 4].map((step) => (
                      <span
                        key={step}
                        className={`h-1 rounded-full ${
                          strength.score >= step ? STRENGTH_COLORS[strength.score] : 'bg-line'
                        }`}
                      />
                    ))}
                  </div>
                  <span>{strength.label}</span>
                </div>
              ) : undefined
            }
            {...register('newPassword')}
          />
          <PasswordField
            label="Confirmar nova senha"
            icon={Lock}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Alterar senha
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

function SessionsSection() {
  const notify = useToast();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<SessionDto[]>('/auth/sessions'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sessions'] });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void refresh();
      notify('Dispositivo desconectado');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const revokeOthers = useMutation({
    mutationFn: () => api('/auth/sessions/revoke-others', { method: 'POST' }),
    onSuccess: () => {
      void refresh();
      notify('Os outros dispositivos foram desconectados');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const others = (data ?? []).filter((session) => !session.current);

  return (
    <SettingsSection
      title="Dispositivos conectados"
      description="Onde sua conta está aberta agora. Desconecte qualquer aparelho que você não reconheça."
    >
      {isPending ? (
        <p className="text-sm text-slate">Carregando…</p>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-[12px] border border-line">
            {(data ?? []).map((session) => {
              const { label, icon: Icon } = describeDevice(session.userAgent);
              return (
                <li key={session.id} className="flex items-center gap-4 px-4 py-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-sunken text-steel">
                    <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {label}
                      {session.current ? (
                        <span className="rounded-full bg-positive-soft px-2 py-0.5 text-[11px] font-medium text-positive">
                          Este dispositivo
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[13px] text-slate">
                      Conectado em {dateTime.format(new Date(session.createdAt))}
                    </p>
                  </div>
                  {!session.current ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => revoke.mutate(session.id)}
                      loading={revoke.isPending && revoke.variables === session.id}
                    >
                      Desconectar
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {others.length > 0 ? (
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => revokeOthers.mutate()}
                loading={revokeOthers.isPending}
              >
                {!revokeOthers.isPending ? <LogOut size={17} aria-hidden="true" /> : null}
                Desconectar todos os outros
              </Button>
            </div>
          ) : null}
        </>
      )}
    </SettingsSection>
  );
}
