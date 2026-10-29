import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/form';
import { formatMonthTitle } from '@/lib/dates';

/** Navegação entre meses (‹ outubro de 2026 ›), com atalho para o mês atual. */
export function MonthSwitcher({
  month,
  isCurrent,
  onShift,
  onToday,
  loading,
}: {
  month: string;
  isCurrent: boolean;
  onShift: (amount: number) => void;
  onToday: () => void;
  loading: boolean;
}) {
  const nav =
    'grid size-10 place-items-center rounded-[10px] border border-line bg-surface text-steel transition-colors hover:bg-sunken hover:text-graphite';
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onShift(-1)} className={nav} aria-label="Mês anterior">
        <ChevronLeft size={18} />
      </button>
      <h2
        className="min-w-[180px] text-center font-display text-xl font-semibold first-letter:uppercase"
        aria-live="polite"
      >
        {formatMonthTitle(month)}
      </h2>
      <button type="button" onClick={() => onShift(1)} className={nav} aria-label="Próximo mês">
        <ChevronRight size={18} />
      </button>
      {!isCurrent ? (
        <Button type="button" variant="ghost" onClick={onToday}>
          Mês atual
        </Button>
      ) : null}
      {loading ? (
        <span className="ml-1 size-2 animate-pulse rounded-full bg-ember" aria-hidden="true" />
      ) : null}
    </div>
  );
}
