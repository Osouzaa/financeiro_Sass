import type { ProfileDto } from '@financeiro/shared';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '@/lib/api';

const DISMISS_KEY = 'fin:whatsapp-prompt-dismissed';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Convite no painel para quem ainda não cadastrou o celular. Fecha de vez neste navegador. */
export function WhatsappPrompt() {
  const [dismissed, setDismissed] = useState(readDismissed);
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api<ProfileDto>('/me'),
  });
  if (dismissed || !profile || profile.phone) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Sem armazenamento local, o convite só some até recarregar
    }
  };

  return (
    <div className="card mb-4 flex items-center gap-4 border-positive/25 bg-positive-soft/50 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-positive text-white">
        <MessageCircle size={19} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Receba seus avisos no WhatsApp</p>
        <p className="text-sm text-steel">
          Cadastre o celular para receber vencimentos e resumos, e em breve lançar gastos por
          mensagem. É opcional.
        </p>
      </div>
      <Link
        to="/configuracoes/perfil#whatsapp"
        className="hidden h-10 shrink-0 items-center rounded-[10px] bg-graphite px-4 text-sm font-medium text-white transition-colors hover:bg-black sm:inline-flex"
      >
        Conectar
      </Link>
      <button
        type="button"
        onClick={dismiss}
        className="grid size-8 shrink-0 place-items-center rounded-[8px] text-slate hover:bg-black/5"
        aria-label="Agora não"
        title="Agora não"
      >
        <X size={16} />
      </button>
    </div>
  );
}
