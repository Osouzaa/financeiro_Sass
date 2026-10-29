import type {
  AdminMetricsDto,
  AdminUserDto,
  AuditEntryDto,
  PageDto,
  PlanDto,
} from '@financeiro/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => api<AdminMetricsDto>('/admin/metrics'),
  });
}

export function useAdminUsers(q: string, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set('q', q);
  return useQuery({
    queryKey: ['admin', 'users', { q, page }],
    queryFn: () => api<PageDto<AdminUserDto>>(`/admin/users?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminPlans() {
  return useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api<PlanDto[]>('/admin/plans') });
}

export function useAdminAudit(page: number) {
  return useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: () => api<PageDto<AuditEntryDto>>(`/admin/audit?page=${page}`),
    placeholderData: keepPreviousData,
  });
}

/** Ações do admin mudam usuários, métricas, auditoria e talvez o próprio plano. */
export function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: ['me-plan'] }),
      queryClient.invalidateQueries({ queryKey: ['plans'] }),
    ]);
}
