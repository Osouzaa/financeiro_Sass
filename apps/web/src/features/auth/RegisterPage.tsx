import { registerSchema, type RegisterInput } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Button, FormAlert, PasswordField, TextField } from '@/components/form';
import { applyServerErrors } from './apply-server-errors';
import { useAuth } from './auth-context';
import { AuthLayout } from './AuthLayout';
import { passwordStrength } from './password-strength';

const STRENGTH_COLORS = ['bg-negative', 'bg-negative', 'bg-ember', 'bg-positive', 'bg-positive'];

export function RegisterPage() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const password = useWatch({ control, name: 'password' }) ?? '';
  const strength = passwordStrength(password);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await createAccount(values);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(applyServerErrors(error, setError));
    }
  });

  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="Leva menos de um minuto. Suas categorias já vêm prontas para começar."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="link-ember">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={formError} />
        <TextField
          label="Nome"
          icon={User}
          placeholder="Como você quer ser chamado"
          autoComplete="name"
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="E-mail"
          type="email"
          icon={Mail}
          placeholder="voce@exemplo.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Senha"
          icon={Lock}
          placeholder="Mínimo de 8 caracteres"
          autoComplete="new-password"
          error={errors.password?.message}
          hint={
            password ? (
              <div className="flex items-center gap-3">
                <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className={`h-1 rounded-full transition-colors ${
                        strength.score >= step ? STRENGTH_COLORS[strength.score] : 'bg-line'
                      }`}
                    />
                  ))}
                </div>
                <span className="w-20 text-right">{strength.label}</span>
              </div>
            ) : (
              'Use letras e números. Maiúsculas e símbolos deixam a senha mais forte.'
            )
          }
          {...register('password')}
        />
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
          {!isSubmitting ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </Button>
      </form>
    </AuthLayout>
  );
}
