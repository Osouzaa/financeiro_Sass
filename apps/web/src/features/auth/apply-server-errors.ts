import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api';

/**
 * Coloca os erros por campo vindos da API nos campos do formulário.
 * Retorna a mensagem geral para exibir no topo.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): string {
  if (!(error instanceof ApiError)) return 'Algo deu errado. Tente novamente.';
  for (const [field, messages] of Object.entries(error.fields)) {
    if (messages[0]) setError(field as Path<T>, { message: messages[0] });
  }
  return error.message;
}
