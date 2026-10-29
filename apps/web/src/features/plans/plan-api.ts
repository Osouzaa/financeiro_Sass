import type { MyPlanDto, PlanDto } from '@financeiro/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePublicPlans() {
  return useQuery({
    queryKey: ['plans', 'public'],
    queryFn: () => api<PlanDto[]>('/plans', { retryOnUnauthorized: false }),
    staleTime: 10 * 60_000,
  });
}

/** Plano atual e uso. Invalide ['me-plan'] ao criar ou excluir contas, recorrências e limites. */
export function useMyPlan() {
  return useQuery({
    queryKey: ['me-plan'],
    queryFn: () => api<MyPlanDto>('/me/plan'),
  });
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "Grátis", "R$ 14,90/mês", "R$ 149,00/ano". */
export function formatPlanPrice(plan: Pick<PlanDto, 'priceCents' | 'interval'>): string {
  if (plan.priceCents === 0) return 'Grátis';
  return `${brl.format(plan.priceCents / 100)}/${plan.interval === 'YEAR' ? 'ano' : 'mês'}`;
}
