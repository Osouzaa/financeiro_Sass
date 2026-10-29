import type { InvoiceDetailDto, InvoiceDto } from '@financeiro/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useInvoices(filter: { accountId?: string; unpaid?: boolean }, enabled = true) {
  const params = new URLSearchParams();
  if (filter.accountId) params.set('accountId', filter.accountId);
  if (filter.unpaid) params.set('unpaid', 'true');
  return useQuery({
    queryKey: ['invoices', filter],
    queryFn: () => api<InvoiceDto[]>(`/invoices?${params.toString()}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', 'detail', id],
    queryFn: () => api<InvoiceDetailDto>(`/invoices/${id}`),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}
