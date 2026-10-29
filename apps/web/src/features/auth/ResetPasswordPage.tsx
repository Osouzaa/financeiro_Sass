import { resetPasswordSchema, type ResetPasswordInput } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, KeyRound, Lock, TimerReset } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, FormAlert, PasswordField } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import { applyServerErrors } from './apply-server-errors';
import { useAuth } from './auth-context';
import { AuthLayout } from './AuthLayout';
import { PasswordStrengthHint } from './PasswordStrengthHint';

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{32,128}$/;

export function ResetPasswordPage() {
  const [params, setParams] = useSearchParams();
  // O token sai da barra de endereço logo ao abrir: não fica no histórico nem é copiado sem querer
  const [token] = useState(() => params.get('token') ?? '');
  useEffect(() => {
    if (params.has('token')) setParams({}, { replace: true });
  }, [params, setParams]);

  const [expired, setExpired] = useState(!TOKEN_FORMAT.test(token));

  return (
    <AuthLayout
      title={expired ? 'Link inválido ou expirado' : 'Crie uma nova senha'}
      subtitle={
        expired
          ? 'Links de redefinição valem por 30 minutos e só uma vez. Peça outro, é rápido.'
          : 'Depois de salvar, todas as sessões abertas são encerradas e você entra de novo com a senha nova.'
      }
      footer={
        <Link to="/entrar" className="link-ember inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden="true" /> Voltar para o login
        </Link>
      }
    >
      {expired ? (
        <div className="flex flex-col items-center gap-5 rounded-[14px] border border-line bg-canvas p-6 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-ember-soft text-ember-deep">
            <TimerReset size={24} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <Link
            to="/recuperar-senha"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-graphite px-5 text-[15px] font-medium text-white transition-colors hover:bg-black"
          >
            Pedir um novo link
          </Link>
        </div>
      ) : (
        <ResetForm token={token} onExpired={() => setExpired(true)} />
      )}
    </AuthLayout>
  );
}

function ResetForm({ token, onExpired }: { token: string; onExpired: () => void }) {
  const navigate = useNavigate();
  const { status, logout } = useAuth();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, newPassword: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'newPassword' }) ?? '';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: values,
        retryOnUnauthorized: false,
      });
      // A API encerrou todas as sessões; se esta aba estava logada, sai também
      if (status === 'authenticated') await logout();
      navigate('/entrar', { replace: true, state: { passwordReset: true } });
    } catch (error) {
      if (error instanceof ApiError && error.fields.token) {
        onExpired();
        return;
      }
      setFormError(applyServerErrors(error, setError));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <PasswordField
        label="Nova senha"
        icon={Lock}
        placeholder="Mínimo de 8 caracteres"
        autoComplete="new-password"
        autoFocus
        error={errors.newPassword?.message}
        hint={<PasswordStrengthHint password={password} />}
        {...register('newPassword')}
      />
      <PasswordField
        label="Confirme a nova senha"
        icon={KeyRound}
        placeholder="Digite de novo"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}
