import type { RecurrenceDto } from '@financeiro/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRecurrences() {
  return useQuery({
    queryKey: ['recurrences'],
    queryFn: () => api<RecurrenceDto[]>('/recurrences'),
  });
}
