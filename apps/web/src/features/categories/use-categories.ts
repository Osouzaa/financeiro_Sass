import type { CategoryDto } from '@financeiro/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Categorias do usuário em árvore (categoria > subcategorias). Invalide com a chave ['categories']. */
export function useCategories(includeArchived = false) {
  return useQuery({
    queryKey: ['categories', { includeArchived }],
    queryFn: () =>
      api<CategoryDto[]>(`/categories${includeArchived ? '?includeArchived=true' : ''}`),
    staleTime: 5 * 60_000,
  });
}
