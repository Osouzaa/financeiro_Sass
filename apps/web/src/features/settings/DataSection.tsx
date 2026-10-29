import { deleteAccountSchema, type DeleteAccountInput } from '@financeiro/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Download, Lock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button, FormAlert, PasswordField, TextField } from '@/components/form';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast';
import { applyServerErrors } from '@/features/auth/apply-server-errors';
import { useAuth } from '@/features/auth/auth-context';
import { api, apiBlob } from '@/lib/api';
import { SettingsSection } from './SettingsLayout';

/** Direitos do titular (LGPD): levar os dados e excluir a conta. */
export function DataSection() {
  const notify = useToast();
  const [deleting, setDeleting] = useState(false);
  const download = useMutation({
    mutationFn: async () => {
      const blob = await apiBlob('/me/export');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => notify('Arquivo com seus dados baixado'),
    onError: (error) => notify(error.message, 'error'),
  });

  return (
    <SettingsSection
      title="Seus dados"
      description="Baixe uma cópia de tudo o que o sistema guarda sobre você ou exclua a conta de vez."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line p-4">
          <div>
            <p className="font-medium">Baixar meus dados</p>
            <p className="text-sm text-slate">
              Perfil, contas, categorias, lançamentos, recorrências e orçamentos em um arquivo JSON.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={download.isPending}
            onClick={() => download.mutate()}
          >
            <Download size={16} aria-hidden="true" /> Baixar
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-negative/25 bg-negative-soft/40 p-4">
          <div>
            <p className="font-medium text-negative">Excluir minha conta</p>
            <p className="text-sm text-steel">
              Apaga a conta e todos os registros financeiros. Não dá para desfazer.
            </p>
          </div>
          <Button
            type="button"
            className="!bg-negative hover:!bg-[#a92e26]"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={16} aria-hidden="true" /> Excluir conta
          </Button>
        </div>
      </div>
      {deleting ? <DeleteAccountModal onClose={() => setDeleting(false)} /> : null}
    </SettingsSection>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { endSession } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '', confirmation: '' as 'EXCLUIR' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await api('/me', { method: 'DELETE', body: values });
      endSession();
      navigate('/entrar', { replace: true, state: { accountDeleted: true } });
    } catch (error) {
      setFormError(applyServerErrors(error, setError));
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Excluir a conta?"
      description="Tudo será apagado: contas, cartões, lançamentos, recorrências, orçamentos e o perfil."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="delete-account-form"
            loading={isSubmitting}
            className="!bg-negative hover:!bg-[#a92e26]"
          >
            Excluir definitivamente
          </Button>
        </>
      }
    >
      <form id="delete-account-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />
        <p className="text-sm text-steel">
          Se quiser guardar uma cópia, baixe seus dados antes. Se tiver uma assinatura paga, ela é
          cancelada junto.
        </p>
        <PasswordField
          label="Sua senha"
          icon={Lock}
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label='Digite "EXCLUIR" para confirmar'
          autoComplete="off"
          error={errors.confirmation?.message}
          {...register('confirmation')}
        />
      </form>
    </Modal>
  );
}
