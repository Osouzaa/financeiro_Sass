import type {
  TransactionDto,
  TransactionFilter,
  TransactionListDto,
  TransactionStatus,
} from '@financeiro/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

export function useTransactions(filter: TransactionFilter) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, String(value));
  }
  return useQuery({
    queryKey: ['transactions', filter],
    queryFn: () => api<TransactionListDto>(`/transactions?${params.toString()}`),
    // Ao trocar de mês ou filtro, a lista anterior fica na tela até a nova chegar
    placeholderData: keepPreviousData,
  });
}

/** Lançamentos mexem em saldos e faturas: atualiza tudo que depende deles. */
export function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['recurrences'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: ['me-plan'] }),
      queryClient.invalidateQueries({ queryKey: ['projection'] }),
    ]);
}

export function useToggleStatus() {
  const invalidate = useInvalidateMoney();
  const notify = useToast();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TransactionStatus }) =>
      api<TransactionDto>(`/transactions/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: (transaction) => {
      void invalidate();
      notify(
        transaction.status === 'PAID'
          ? `${transaction.description} marcado como realizado`
          : `${transaction.description} voltou para previsto`,
      );
    },
    onError: (error) => notify(error.message, 'error'),
  });
}
