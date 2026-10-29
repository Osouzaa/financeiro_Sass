import { parseLoginIdentifier } from '@financeiro/shared';
import type { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Usuário pelo que foi digitado no campo "E-mail ou CPF". Algo que não é nem
 * e-mail nem CPF válido devolve null, sem consultar o banco.
 */
export async function findUserByIdentifier<S extends Prisma.UserSelect>(
  prisma: PrismaService,
  identifier: string,
  select: S,
): Promise<Prisma.UserGetPayload<{ select: S }> | null> {
  const parsed = parseLoginIdentifier(identifier);
  if (!parsed) return null;
  if ('email' in parsed) {
    return prisma.user.findUnique({
      where: { email: parsed.email },
      select,
    }) as Promise<Prisma.UserGetPayload<{ select: S }> | null>;
  }
  const row = await prisma.userCpf.findUnique({
    where: { cpf: parsed.cpf },
    select: { user: { select } },
  });
  return (row?.user as Prisma.UserGetPayload<{ select: S }> | undefined) ?? null;
}
