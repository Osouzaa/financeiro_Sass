import type { AccountType, CategoryType } from './enums';
import type { AlertPreferences } from './schemas/profile';

/** Contratos de resposta da API (o que o front recebe). */

export interface UserDto {
  id: string;
  name: string;
  email: string;
  /** Muda sempre que a foto muda; null quando não há foto. Usado para invalidar cache. */
  avatarVersion: string | null;
}

export interface ProfileDto extends UserDto {
  alerts: AlertPreferences;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  /** Validade do access token em segundos. */
  expiresIn: number;
  user: UserDto;
}

export interface SessionDto {
  id: string;
  userAgent: string | null;
  createdAt: string;
  current: boolean;
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

export interface AccountDto {
  id: string;
  name: string;
  type: AccountType;
  color: string | null;
  initialBalanceCents: number;
  initialBalanceDate: string;
  archived: boolean;
  /** Conta corrente/carteira: saldo atual. Cartão: total em aberto (dívida). */
  balanceCents: number;
  closingDay: number | null;
  dueDay: number | null;
  creditLimitCents: number | null;
  /** Limite − total em aberto. Só para cartão. */
  availableLimitCents: number | null;
  paymentAccountId: string | null;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  /** Erros por campo, quando a validação falha. */
  fields?: Record<string, string[]>;
}
