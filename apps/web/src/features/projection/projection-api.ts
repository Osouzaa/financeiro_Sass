import type { ProjectionDto } from '@financeiro/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProjection(days: number, accountId?: string) {
  const params = new URLSearchParams({ days: String(days) });
  if (accountId) params.set('accountId', accountId);
  return useQuery({
    queryKey: ['projection', { days, accountId }],
    queryFn: () => api<ProjectionDto>(`/projection?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
}
