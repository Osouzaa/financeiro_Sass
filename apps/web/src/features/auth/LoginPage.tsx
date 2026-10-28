import { loginSchema, type LoginInput } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button, FormAlert, TextField } from '@/components/form';
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
    <AuthLayout title="Entrar">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={formError} />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting} className="mt-4 w-full">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-10 text-sm text-steel">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="link-ember font-medium">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
}
