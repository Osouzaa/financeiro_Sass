import { updateProfileSchema, type UpdateProfileInput, type UserDto } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Camera, Lock, Mail, Trash2, User } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Avatar } from '@/components/Avatar';
import { Button, FormAlert, PasswordField, TextField } from '@/components/form';
import { useToast } from '@/components/toast';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { useAuth } from '@/features/auth/auth-context';
import { api, ApiError } from '@/lib/api';
import { squareThumbnail } from '@/lib/image';
import { SettingsSection } from './SettingsLayout';

export function ProfilePage() {
  return (
    <div className="space-y-4">
      <PhotoSection />
      <DetailsSection />
    </div>
  );
}

function PhotoSection() {
  const { user, updateUser } = useAuth();
  const notify = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', await squareThumbnail(file), 'avatar.jpg');
      return api<UserDto>('/me/avatar', { method: 'PUT', body: form });
    },
    onSuccess: (next) => {
      updateUser(next);
      notify('Foto atualizada');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: () => api<UserDto>('/me/avatar', { method: 'DELETE' }),
    onSuccess: (next) => {
      updateUser(next);
      notify('Foto removida');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  return (
    <SettingsSection
      title="Foto do perfil"
      description="Aparece no menu e nos seus registros. JPG, PNG ou WebP; recortamos no centro."
    >
      <div className="flex flex-wrap items-center gap-5">
        <Avatar user={user} size={88} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Escolher foto"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="secondary"
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {!upload.isPending ? <Camera size={17} aria-hidden="true" /> : null}
            {user?.avatarVersion ? 'Trocar foto' : 'Enviar foto'}
          </Button>
          {user?.avatarVersion ? (
            <Button
              type="button"
              variant="ghost"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {!remove.isPending ? <Trash2 size={17} aria-hidden="true" /> : null}
              Remover
            </Button>
          ) : null}
        </div>
      </div>
    </SettingsSection>
  );
}

function DetailsSection() {
  const { user, updateUser } = useAuth();
  const notify = useToast();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', currentPassword: '' },
  });

  const email = useWatch({ control, name: 'email' });
  const emailChanged = email.trim().toLowerCase() !== user?.email;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      const next = await api<UserDto>('/me', {
        method: 'PATCH',
        body: { ...values, currentPassword: emailChanged ? values.currentPassword : undefined },
      });
      updateUser(next);
      reset({ name: next.name, email: next.email, currentPassword: '' });
      notify('Perfil atualizado');
    } catch (error) {
      const message = applyServerErrors(error, setError);
      if (!(error instanceof ApiError) || Object.keys(error.fields).length === 0) {
        setFormError(message);
      }
    }
  });

  return (
    <SettingsSection
      title="Dados pessoais"
      description="Seu nome aparece na saudação do painel. O e-mail é usado para entrar."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={formError} />
        <TextField
          label="Nome"
          icon={User}
          placeholder="Seu nome"
          autoComplete="name"
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
        {emailChanged ? (
          <PasswordField
            label="Senha atual"
            icon={Lock}
            placeholder="Confirme sua senha para trocar o e-mail"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
