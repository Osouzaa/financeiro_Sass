import { loginSchema, type LoginInput } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button, FormAlert, PasswordField, TextField } from '@/components/form';
import { applyServerErrors } from './apply-server-errors';
import { useAuth } from './auth-context';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await login(values);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(applyServerErrors(error, setError));
    }
  });

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entre para acompanhar suas contas, cartões e a projeção do mês."
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
        <FormAlert message={formError} />
        <TextField
          label="E-mail"
          type="email"
          icon={Mail}
          placeholder="voce@exemplo.com"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Senha"
          icon={Lock}
          placeholder="Digite sua senha"
          autoComplete="current-password"
          error={errors.password?.message}
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
