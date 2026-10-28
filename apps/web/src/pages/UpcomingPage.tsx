import { PageHeader } from '@/layout/AppLayout';

/** Tela ainda não construída: diz o que ela vai fazer, sem fingir que funciona. */
export function UpcomingPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-[15px] text-ink-soft">
        Esta tela entra na próxima etapa do desenvolvimento.
      </div>
    </>
  );
}
