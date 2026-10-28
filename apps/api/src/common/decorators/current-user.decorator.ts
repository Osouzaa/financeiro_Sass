import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Usuário autenticado, extraído do access token pelo JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
}

export type AuthenticatedRequest = Request & { user: AuthUser };

/**
 * Injeta o usuário autenticado no handler.
 * O `UserId` vem SEMPRE do token, nunca do corpo da requisição:
 * é isso que garante que um usuário não acessa dados de outro.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
