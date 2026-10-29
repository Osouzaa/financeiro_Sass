import {
  formatPhone,
  phoneInputSchema,
  type PhoneInput,
  type ProfileDto,
} from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, FormAlert, TextField } from '@/components/form';
import { useToast } from '@/components/toast';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { api, ApiError } from '@/lib/api';
import { SettingsSection } from './SettingsLayout';

/**
 * Celular para o assistente no WhatsApp: opcional, cadastrado depois da conta.
 * O consentimento é explícito e começa desmarcado (LGPD e regras do WhatsApp).
 */
export function WhatsappSection({ profile }: { profile?: ProfileDto }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const current = profile?.phone ?? null;
  const [formError, setFormError] = useState<string>();
  const {
    control,
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PhoneInput>({
    resolver: zodResolver(phoneInputSchema),
    values: {
      phone: current ? formatPhone(current.number) : '',
      whatsappOptIn: current?.whatsappOptIn ?? false,
    },
  });

  const remove = useMutation({
    mutationFn: () => api<ProfileDto>('/me/phone', { method: 'DELETE' }),
    onSuccess: (next) => {
      queryClient.setQueryData(['profile'], next);
      reset({ phone: '', whatsappOptIn: false });
      notify('Celular removido');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      const next = await api<ProfileDto>('/me/phone', { method: 'PUT', body: values });
      queryClient.setQueryData(['profile'], next);
      notify(next.phone?.whatsappOptIn ? 'WhatsApp conectado' : 'Celular salvo');
    } catch (error) {
      const message = applyServerErrors(error, setError);
      if (!(error instanceof ApiError) || Object.keys(error.fields).length === 0) {
        setFormError(message);
      }
    }
  });

  return (
    <SettingsSection
      title="WhatsApp"
      description="Opcional. Com o celular, o assistente vai mandar seus avisos e resumos e você vai poder lançar gastos por mensagem."
    >
      <form id="whatsapp" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={formError} />
        {current ? (
          <div className="flex items-center gap-3 rounded-[12px] border border-line bg-canvas px-4 py-3 text-sm">
            <span className="grid size-9 place-items-center rounded-full bg-positive-soft text-positive">
              <MessageCircle size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{formatPhone(current.number)}</p>
              <p className="text-[13px] text-slate">
                {current.whatsappOptIn
                  ? current.verified
                    ? 'Mensagens autorizadas e número confirmado'
                    : 'Mensagens autorizadas. A confirmação do número acontece quando o assistente for ativado.'
                  : 'Número salvo, sem autorização para mensagens'}
              </p>
            </div>
          </div>
        ) : null}
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextField
              ref={field.ref}
              name={field.name}
              label="Celular com DDD"
              icon={Smartphone}
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 99999-8888"
              maxLength={16}
              value={field.value}
              onChange={(event) => field.onChange(formatPhone(event.target.value))}
              onBlur={field.onBlur}
              error={errors.phone?.message}
            />
          )}
        />
        <label className="flex cursor-pointer items-start gap-3 text-sm text-steel">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-ember)]"
            {...register('whatsappOptIn')}
          />
          <span>
            Autorizo o Financeiro a me enviar mensagens pelo WhatsApp neste número (avisos de
            vencimento, orçamento e resumos). Posso cancelar quando quiser, aqui mesmo.
          </span>
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          {current ? (
            <Button
              type="button"
              variant="ghost"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
              className="mr-auto !text-negative hover:!bg-negative-soft"
            >
              Remover celular
            </Button>
          ) : null}
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {current ? 'Salvar' : 'Conectar WhatsApp'}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
