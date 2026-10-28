import * as bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

/**
 * Hash de uma senha qualquer, usado quando o usuário não existe.
 * Assim a verificação leva o mesmo tempo nos dois casos e não revela quais e-mails estão cadastrados.
 */
const DUMMY_HASH = '$2b$12$/pelSEX1kDoOaYyLcatROe4tC9ik3luUZf0LbL38Ra2b8Mr5ykoyq';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH).then((ok) => ok && !!hash);
}
