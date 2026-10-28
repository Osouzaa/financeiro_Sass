import type { BudgetMonthDto } from '@financeiro/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useBudgetMonth(month: string) {
  return useQuery({
    queryKey: ['budgets', month],
    queryFn: () => api<BudgetMonthDto>(`/budgets?month=${encodeURIComponent(month)}`),
    placeholderData: keepPreviousData,
  });
}
