import type { CategoryType } from './enums';

/** Contratos de resposta da API (o que o front recebe). */

export interface UserDto {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  /** Validade do access token em segundos. */
  expiresIn: number;
  user: UserDto;
}

export interface CategoryDto {
  id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  children: CategoryDto[];
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  /** Erros por campo, quando a validação falha. */
  fields?: Record<string, string[]>;
}
