import { useMutation } from '@tanstack/react-query';
import { MailWarning, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';

/** Aviso no topo enquanto o e-mail não é confirmado. Fecha até recarregar a página. */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const notify = useToast();
  const [hidden, setHidden] = useState(false);
  const resend = useMutation({
    mutationFn: () => api('/auth/verify-email/resend', { method: 'POST' }),
    onSuccess: () => notify(`Link enviado para ${user?.email}`),
    onError: (error) => notify(error.message, 'error'),
  });

  if (!user || user.emailVerified || hidden) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-[#f3d9a4] bg-[#fff6e0] px-5 py-2.5 text-sm text-[#6b5214] sm:px-8"
    >
      <MailWarning size={18} className="shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        Confirme seu e-mail <strong className="font-medium break-all">{user.email}</strong> para
        receber avisos e recuperar o acesso quando precisar.
      </p>
      <button
        type="button"
        onClick={() => resend.mutate()}
        disabled={resend.isPending || resend.isSuccess}
        className="shrink-0 font-medium underline-offset-4 hover:underline disabled:opacity-60"
      >
        {resend.isSuccess ? 'Enviado' : 'Reenviar link'}
      </button>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="grid size-7 shrink-0 place-items-center rounded-[8px] hover:bg-black/5"
        aria-label="Fechar aviso"
      >
        <X size={15} />
      </button>
    </div>
  );
}
