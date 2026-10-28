import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Libera a rota do guard de autenticação (todas as rotas são protegidas por padrão). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
