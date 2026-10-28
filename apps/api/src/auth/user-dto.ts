import type { UserDto } from '@financeiro/shared';

/** Campos do usuário que podem sair da API (nunca o hash da senha nem a foto em bytes). */
export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUpdatedAt: true,
} as const;

export function toUserDto(user: {
  id: string;
  name: string;
  email: string;
  avatarUpdatedAt?: Date | null;
}): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarVersion: user.avatarUpdatedAt ? String(user.avatarUpdatedAt.getTime()) : null,
  };
}
