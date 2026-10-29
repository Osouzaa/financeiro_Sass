import { registerSchema, type RegisterInput } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, FormAlert, PasswordField, TextField } from '@/components/form';
import { applyServerErrors } from './apply-server-errors';
import { useAuth } from './auth-context';
import { AuthLayout } from './AuthLayout';
import { CpfField } from './identity-fields';
import { usePublicPlans } from '@/features/plans/plan-api';
import { PasswordStrengthHint } from './PasswordStrengthHint';

export function RegisterPage() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string>();
  // Plano escolhido na página de divulgação (a assinatura é feita depois do cadastro)
  const [params] = useSearchParams();
  const { data: plans = [] } = usePublicPlans();
  const chosen = plans.find((plan) => plan.code === params.get('plano') && plan.priceCents > 0);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', cpf: '', password: '', acceptTerms: false },
  });

  const password = useWatch({ control, name: 'password' }) ?? '';

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
        {chosen ? (
          <p className="rounded-[10px] border border-ember/30 bg-ember-soft/60 px-4 py-3 text-sm text-ember-deep">
            Você escolheu o <strong>{chosen.name}</strong>. Crie a conta grátis primeiro; a
            assinatura fica em Configurações → Plano.
          </p>
        ) : null}
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
        <Controller
          control={control}
          name="cpf"
          render={({ field }) => (
            <CpfField
              ref={field.ref}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.cpf?.message}
              hint="Você também pode entrar com o CPF."
            />
          )}
        />
        <PasswordField
          label="Senha"
          icon={Lock}
          placeholder="Mínimo de 8 caracteres"
          autoComplete="new-password"
          error={errors.password?.message}
          hint={<PasswordStrengthHint password={password} />}
          {...register('password')}
        />
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-steel">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-ember)]"
              aria-invalid={errors.acceptTerms ? true : undefined}
              {...register('acceptTerms')}
            />
            <span>
              Li e aceito os{' '}
              <Link to="/termos" target="_blank" className="link-ember">
                Termos de uso
              </Link>{' '}
              e a{' '}
              <Link to="/privacidade" target="_blank" className="link-ember">
                Política de privacidade
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms?.message ? (
            <p className="mt-1.5 text-[13px] text-negative">{errors.acceptTerms.message}</p>
          ) : null}
        </div>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
          {!isSubmitting ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </Button>
      </form>
    </AuthLayout>
  );
}
