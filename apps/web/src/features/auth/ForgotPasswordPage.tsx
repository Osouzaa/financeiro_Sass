import { forgotPasswordSchema, type ForgotPasswordInput } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { Button, FormAlert } from '@/components/form';
import { api } from '@/lib/api';
import { applyServerErrors } from './apply-server-errors';
import { AuthLayout } from './AuthLayout';
import { IdentifierField } from './identity-fields';

/** Espera antes de reenviar: evita disparar vários e-mails sem querer. */
const RESEND_SECONDS = 60;

export function ForgotPasswordPage() {
  const location = useLocation();
  const prefill = (location.state as { identifier?: string } | null)?.identifier ?? '';
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [formError, setFormError] = useState<string>();
  const {
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: prefill },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const send = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: values,
        retryOnUnauthorized: false,
      });
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch (error) {
      setFormError(applyServerErrors(error, setError));
    }
  });

  return (
    <AuthLayout
      title={sent ? 'Confira seu e-mail' : 'Esqueceu a senha?'}
      subtitle={
        sent
          ? 'Se existir uma conta com esse e-mail ou CPF, mandamos um link para o e-mail cadastrado.'
          : 'Informe o e-mail ou o CPF da conta. Enviamos um link para você criar uma senha nova.'
      }
      footer={
        <Link to="/entrar" className="link-ember inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden="true" /> Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4 rounded-[14px] border border-line bg-canvas p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ember-soft text-ember-deep">
              <MailCheck size={22} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="text-sm text-steel">
              <p className="font-medium text-graphite">O link vale por 30 minutos</p>
              <p className="mt-1">
                Ele só funciona uma vez. Não achou? Veja a caixa de spam ou promoções, ou confira se
                digitou o mesmo e-mail ou CPF do cadastro.
              </p>
            </div>
          </div>
          <FormAlert message={formError} />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            disabled={cooldown > 0}
            loading={isSubmitting}
            onClick={() => void send()}
          >
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar link'}
          </Button>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-sm text-slate hover:text-graphite"
          >
            Usar outro e-mail ou CPF ({getValues('identifier')})
          </button>
        </div>
      ) : (
        <form onSubmit={send} noValidate className="flex flex-col gap-5">
          <FormAlert message={formError} />
          <Controller
            control={control}
            name="identifier"
            render={({ field }) => (
              <IdentifierField
                ref={field.ref}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                autoFocus
                error={errors.identifier?.message}
              />
            )}
          />
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            <Send size={17} aria-hidden="true" /> Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
