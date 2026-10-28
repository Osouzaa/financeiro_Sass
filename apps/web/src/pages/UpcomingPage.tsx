import { Hammer } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/layout/AppLayout';

/** Tela ainda não construída: diz o que ela vai fazer, sem fingir que funciona. */
export function UpcomingPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember-deep">
          <Hammer size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="mt-5 font-display text-xl font-semibold">Em construção</p>
        <p className="mt-2 max-w-[48ch] text-[15px] text-slate">
          Esta tela entra na próxima etapa do desenvolvimento. Enquanto isso, você já pode conferir
          suas categorias.
        </p>
        <Link to="/configuracoes/categorias" className="link-ember mt-5 text-sm">
          Ver categorias
        </Link>
      </div>
    </>
  );
}
