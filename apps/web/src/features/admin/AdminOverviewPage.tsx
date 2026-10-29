import { formatBRL } from '@financeiro/shared';
import { Ban, TrendingUp, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { useAdminMetrics } from './admin-api';

export function AdminOverviewPage() {
  const { data, isPending, error } = useAdminMetrics();
  if (error) {
    return (
      <p role="alert" className="rounded-[12px] bg-negative-soft px-4 py-3 text-sm text-negative">
        {error.message}
      </p>
    );
  }
  if (isPending || !data) {
    return <div className="card h-[220px] animate-pulse bg-sunken/40" aria-hidden="true" />;
  }
  const max = Math.max(1, ...data.byPlan.map((plan) => plan.users));

  return (
    <>
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Users} label="Contas" value={String(data.users)} />
        <Tile icon={UserPlus} label="Novas em 30 dias" value={String(data.newUsersLast30Days)} />
        <Tile icon={Ban} label="Suspensas" value={String(data.suspended)} />
        <Tile
          icon={TrendingUp}
          label="Receita mensal estimada"
          value={formatBRL(data.mrrCents)}
          note="Assinaturas ativas; planos anuais ÷ 12"
        />
      </section>

      <section aria-labelledby="titulo-por-plano" className="card mt-4 p-6">
        <h2 id="titulo-por-plano" className="text-lg font-semibold">
          Contas por plano
        </h2>
        <ul className="mt-4 space-y-3">
          {data.byPlan.map((plan) => (
            <li
              key={plan.planId}
              className="grid grid-cols-[120px_minmax(0,1fr)_48px] items-center gap-3 text-sm"
            >
              <span className="truncate">{plan.name}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-ember"
                  style={{ width: `${(plan.users / max) * 100}%` }}
                />
              </span>
              <span className="tabular text-right font-medium">{plan.users}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate">{label}</span>
        <span className="grid size-9 place-items-center rounded-[10px] bg-sunken text-steel">
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p className="tabular mt-2 font-display text-[28px] leading-none font-semibold tracking-[-0.02em]">
        {value}
      </p>
      {note ? <p className="mt-2 text-[12px] text-faint">{note}</p> : null}
    </div>
  );
}
