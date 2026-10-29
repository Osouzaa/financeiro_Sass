import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/form';
import { useAdminAudit } from './admin-api';

const ACTIONS: Record<string, string> = {
  SUBSCRIPTION_CHANGED: 'Trocou o plano',
  USER_SUSPENDED: 'Suspendeu a conta',
  USER_REACTIVATED: 'Reativou a conta',
  PLAN_CREATED: 'Criou o plano',
  PLAN_UPDATED: 'Editou o plano',
};

const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Detalhes guardados como JSON: mostra "chave: valor" legível. */
function describe(details: string | null): string {
  if (!details) return '';
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return Object.entries(parsed)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  } catch {
    return details;
  }
}

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, error } = useAdminAudit(page);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (error) {
    return (
      <p role="alert" className="rounded-[12px] bg-negative-soft px-4 py-3 text-sm text-negative">
        {error.message}
      </p>
    );
  }
  return (
    <>
      {isPending ? (
        <div className="card h-[260px] animate-pulse bg-sunken/40" aria-hidden="true" />
      ) : data?.items.length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-slate">
          Nenhuma ação administrativa registrada ainda.
        </div>
      ) : (
        <ol className="card divide-y divide-line">
          {data?.items.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <time
                className="tabular shrink-0 text-[12px] text-slate sm:w-32"
                dateTime={entry.createdAt}
              >
                {when.format(new Date(entry.createdAt))}
              </time>
              <div className="min-w-0 flex-1 text-sm">
                <p>
                  <strong className="font-medium">{entry.actor?.name ?? 'Conta excluída'}</strong>{' '}
                  {(ACTIONS[entry.action] ?? entry.action).toLowerCase()}
                </p>
                <p className="truncate text-[12px] text-slate">{describe(entry.details)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="tabular text-slate">
            {page} de {pages}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      ) : null}
    </>
  );
}
