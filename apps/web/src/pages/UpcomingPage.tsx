import { PageHeader } from '@/layout/AppLayout';

/** Tela ainda não construída: diz o que ela vai fazer, sem fingir que funciona. */
export function UpcomingPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="card-editorial flex flex-col gap-2 bg-ivory p-8 sm:p-14">
        <p className="font-display text-2xl tracking-[-0.02em]">Em construção</p>
        <p className="max-w-[52ch] text-[15px] text-steel">
          Esta tela entra na próxima etapa do desenvolvimento. Enquanto isso, as categorias já estão
          disponíveis em Configurações.
        </p>
      </div>
    </>
  );
}
