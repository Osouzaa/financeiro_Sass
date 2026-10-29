import { loginSchema, type LoginInput } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CircleCheck, Lock } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button, FormAlert, PasswordField } from '@/components/form';
import { applyServerErrors } from './apply-server-errors';
import { useAuth } from './auth-context';
import { AuthLayout } from './AuthLayout';
import { IdentifierField } from './identity-fields';

interface LoginState {
  from?: string;
  /** Veio da tela de redefinir senha. */
  passwordReset?: boolean;
  /** A conta acabou de ser excluída. */
  accountDeleted?: boolean;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LoginState | null) ?? {};
  const [formError, setFormError] = useState<string>();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  // O que já foi digitado segue para a tela de recuperação
  const identifier = useWatch({ control, name: 'identifier' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await login(values);
      navigate(state.from ?? '/', { replace: true });
    } catch (error) {
      setFormError(applyServerErrors(error, setError));
    }
  });

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entre com seu e-mail ou CPF para acompanhar suas contas, cartões e a projeção do mês."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="link-ember">
            Criar conta grátis
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {state.passwordReset ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-[10px] border border-positive/25 bg-positive-soft px-4 py-3 text-sm text-positive"
          >
            <CircleCheck size={18} className="mt-px shrink-0" aria-hidden="true" />
            Senha redefinida. Entre com a nova senha.
          </p>
        ) : null}
        {state.accountDeleted ? (
          <p
            role="status"
            className="rounded-[10px] border border-line bg-canvas px-4 py-3 text-sm text-steel"
          >
            Sua conta e seus dados foram excluídos.
          </p>
        ) : null}
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
        <PasswordField
          label="Senha"
          icon={Lock}
          placeholder="Digite sua senha"
          autoComplete="current-password"
          error={errors.password?.message}
          labelAside={
            <Link to="/recuperar-senha" state={{ identifier }} className="link-ember text-[13px]">
              Esqueci minha senha
            </Link>
          }
          {...register('password')}
        />
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
          {!isSubmitting ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </Button>
      </form>
    </AuthLayout>
  );
}
